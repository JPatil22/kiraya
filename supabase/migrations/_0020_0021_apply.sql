-- ============================================================================
-- Kiraya — migrations 0020 + 0021.
--   0020  visit scheduling (propose / confirm a viewing)
--   0021  possible-duplicate detection for admin review
--
-- Your database already has 0001–0019. Paste into the Supabase SQL editor and
-- Run.
--
-- NOTE: 0020 begins with two ALTER TYPE ... ADD VALUE lines. PostgreSQL will
-- not let a new enum value be USED in the transaction that adds it; creating
-- the functions below is fine, but if the editor objects, run those two lines
-- on their own first and then the rest.
--
-- 0021 creates the pg_trgm extension for fuzzy address matching.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0020 — Visit scheduling
--
-- Contact exchange (0010) ends at a phone number, and then it's phone tag:
-- "Saturday?" "Sunday better." "What time?" — three calls to agree a slot, and
-- nothing recorded anywhere. This makes the slot a row.
--
-- It also gives the post-visit question (0015) something better to hang off. A
-- confirmed visit whose time has passed is a far stronger prompt than "you
-- asked for a number three days ago", because it knows a visit was actually
-- arranged.
--
-- ## Standing
--
-- You may only propose a visit for a listing you already have contact on. The
-- exchange is the introduction; without it this would be a channel for
-- messaging strangers, which is precisely what the contact design avoids.
-- ---------------------------------------------------------------------------

alter type public.notification_kind add value if not exists 'visit_proposed';
alter type public.notification_kind add value if not exists 'visit_answered';

create type public.visit_status as enum (
  'proposed',   -- someone suggested a time
  'confirmed',  -- the other side agreed
  'declined',   -- the other side said no
  'cancelled'   -- called off after being confirmed
);

create table public.visits (
  id                  uuid primary key default gen_random_uuid(),
  property_id         uuid not null references public.properties (id) on delete cascade,
  tenant_id           uuid not null references public.profiles (id) on delete cascade,
  -- Whoever shows them round: the poster, or the broker who suggested it.
  host_id             uuid not null references public.profiles (id) on delete cascade,
  contact_exchange_id uuid not null references public.contact_exchanges (id) on delete cascade,
  scheduled_for       timestamptz not null,
  status              public.visit_status not null default 'proposed',
  proposed_by         uuid not null references public.profiles (id),
  note                text check (char_length(note) <= 500),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint visits_not_self check (tenant_id <> host_id)
);

create index visits_tenant_idx on public.visits (tenant_id, scheduled_for desc);
create index visits_host_idx   on public.visits (host_id, scheduled_for desc);
create index visits_property_idx on public.visits (property_id, status);

create trigger visits_set_updated_at
  before update on public.visits
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Guard: the exchange defines who may schedule with whom, and a visit cannot
-- be arranged for a time that has already passed.
-- ---------------------------------------------------------------------------
create or replace function public.visits_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ex record;
begin
  select tenant_id, property_id, counterparty_id into ex
  from public.contact_exchanges where id = new.contact_exchange_id;

  if ex is null then
    raise exception 'You need contact details before arranging a visit'
      using errcode = '23503';
  end if;

  if new.tenant_id <> ex.tenant_id
     or new.host_id <> ex.counterparty_id
     or new.property_id <> ex.property_id then
    raise exception 'That visit does not match the enquiry it belongs to'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if new.scheduled_for < now() then
      raise exception 'That time has already passed' using errcode = '22007';
    end if;
    if new.proposed_by <> new.tenant_id and new.proposed_by <> new.host_id then
      raise exception 'Only the two people involved can propose a time'
        using errcode = '42501';
    end if;
  else
    -- Rescheduling means proposing again, so the parties stay fixed.
    if new.tenant_id is distinct from old.tenant_id
       or new.host_id is distinct from old.host_id
       or new.property_id is distinct from old.property_id then
      raise exception 'A visit cannot change who it is between' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger visits_guard_biu
  before insert or update on public.visits
  for each row execute function public.visits_guard();

-- ---------------------------------------------------------------------------
-- RLS — the two people involved, and admins.
-- ---------------------------------------------------------------------------
alter table public.visits enable row level security;

create policy visits_select_own on public.visits
  for select using (
    tenant_id = auth.uid() or host_id = auth.uid() or public.is_admin()
  );

create policy visits_insert_own on public.visits
  for insert with check (
    (tenant_id = auth.uid() or host_id = auth.uid())
    and proposed_by = auth.uid()
  );

create policy visits_update_own on public.visits
  for update using (tenant_id = auth.uid() or host_id = auth.uid())
  with check (tenant_id = auth.uid() or host_id = auth.uid());

-- No delete: a visit that was arranged and then called off is history worth
-- keeping, which is what `cancelled` is for.

-- ---------------------------------------------------------------------------
-- Tell the other side. Never the person who acted.
-- ---------------------------------------------------------------------------
create or replace function public.notify_visit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  title  text;
  who    text;
  target uuid;
begin
  select p.title into title from public.properties p where p.id = new.property_id;

  if tg_op = 'INSERT' then
    target := case when new.proposed_by = new.tenant_id then new.host_id else new.tenant_id end;
    select coalesce(full_name, 'Someone') into who
    from public.profiles where id = new.proposed_by;

    perform public.notify(
      target, 'visit_proposed',
      who || ' proposed a visit to "' || coalesce(title, 'your listing') || '" on ' ||
        to_char(new.scheduled_for, 'FMDay FMDD Mon at HH12:MIam'),
      new.property_id
    );

  elsif new.status is distinct from old.status then
    -- Whoever did not cause the change hears about it.
    target := case when auth.uid() = new.tenant_id then new.host_id else new.tenant_id end;
    perform public.notify(
      target, 'visit_answered',
      'A visit to "' || coalesce(title, 'a listing') || '" was ' || new.status::text,
      new.property_id
    );
  end if;

  return new;
end;
$$;

create trigger visits_notify_aiu
  after insert or update on public.visits
  for each row execute function public.notify_visit();


-- ---------------------------------------------------------------------------
-- 0021 — Possible duplicate listings
--
-- The same flat posted by three brokers at three prices is the defining plague
-- of Indian rental sites, and it is the purest expression of what this product
-- claims to be about: truth over volume. A tenant who calls three numbers about
-- one flat has been wasted three times, and the feed looks three times deeper
-- than it is.
--
-- ## Flag, never merge
--
-- This deliberately does not collapse anything. Two genuinely different flats
-- in the same society at the same rent are common, and auto-merging them would
-- silently delete a real landlord's listing on a heuristic. So this surfaces
-- candidate PAIRS for a human, and the existing takedown RPC does the rest.
--
-- ## The signals
--
-- Same locality, same configuration, same area, near-identical all-in cost, and
-- a similar address line. Rent alone is far too weak — half of Baner's 2BHKs
-- ask ₹30,000. Address alone is too weak the other way, since one broker writes
-- "Nyati Estate Rd" and another "Nyati Estate Road". Requiring both, plus
-- trigram similarity on the address, is what makes the pair worth a look.
-- ---------------------------------------------------------------------------

-- Trigram similarity for the fuzzy address comparison.
create extension if not exists pg_trgm;

create or replace view public.v_possible_duplicates as
select
  a.id                          as property_id,
  b.id                          as other_id,
  a.title                       as title,
  b.title                       as other_title,
  a.posted_by                   as posted_by,
  b.posted_by                   as other_posted_by,
  (a.rent + a.maintenance_monthly) as all_in_monthly,
  (b.rent + b.maintenance_monthly) as other_all_in_monthly,
  ar.name                       as area_name,
  round(
    similarity(
      coalesce(a.address_line, a.title),
      coalesce(b.address_line, b.title)
    )::numeric,
    2
  )                             as address_similarity,
  -- Different posters is the case that actually matters: one broker listing the
  -- same flat twice is untidy, three brokers listing it is the plague.
  (a.posted_by <> b.posted_by)  as different_posters
from public.properties a
join public.properties b
  on b.id > a.id                       -- each pair once, never self
 and b.locality_id = a.locality_id
 and b.bhk         = a.bhk
 and b.status      = 'live'
 and a.status      = 'live'
 -- Same area, or both unset. `is not distinct from` so two nulls match.
 and b.area_id is not distinct from a.area_id
 -- Within 5% on the honest number, not on bare rent.
 and abs((a.rent + a.maintenance_monthly) - (b.rent + b.maintenance_monthly))
       <= greatest(a.rent + a.maintenance_monthly, b.rent + b.maintenance_monthly) * 0.05
left join public.areas ar on ar.id = a.area_id
where similarity(
        coalesce(a.address_line, a.title),
        coalesce(b.address_line, b.title)
      ) > 0.3
  -- Admin-only, enforced HERE rather than by a grant: a view runs with its
  -- owner's rights and bypasses RLS on the tables underneath, so a grant alone
  -- would hand every signed-in user a map of which listings resemble which.
  -- Null auth.uid() is the trusted context (service-role / open mode).
  and (auth.uid() is null or public.is_admin());

revoke all on public.v_possible_duplicates from anon;
grant select on public.v_possible_duplicates to authenticated;
