-- ============================================================================
-- 0002_listings_mvp2.sql — Verified Listings (MVP2)
-- properties + the public read-model view (all-in cost, freshness, posted-by).
-- ============================================================================

create type public.availability_status as enum ('available', 'on_hold', 'rented');
create type public.listing_status      as enum ('draft', 'pending_review', 'live', 'rejected', 'archived');

create table public.properties (
  id                  uuid primary key default gen_random_uuid(),
  posted_by           uuid not null references public.profiles (id) on delete cascade,
  locality_id         uuid not null references public.localities (id),

  title               text not null check (char_length(title) between 4 and 120),
  description         text check (char_length(description) <= 2000),
  address_line        text,                       -- coarse; exact address off-platform for MVP
  bhk                 public.bhk_type not null,
  furnishing          public.furnishing_type not null default 'semi',
  occupancy_pref      public.occupancy_type  not null default 'any',

  -- Cost is broken into honest components; the UI shows each + a computed total.
  rent                int not null check (rent >= 0),
  deposit             int not null default 0 check (deposit >= 0),
  maintenance_monthly int not null default 0 check (maintenance_monthly >= 0),
  brokerage           int not null default 0 check (brokerage >= 0),
  one_time_charges    int not null default 0 check (one_time_charges >= 0),

  available_from      date not null,
  availability        public.availability_status not null default 'available',
  status              public.listing_status      not null default 'draft',

  -- Freshness: stamped by admin/authorised verifier (MVP5). Drives the "verified N days ago" line.
  last_verified_at    timestamptz,
  last_verified_by    uuid references public.profiles (id),

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index properties_locality_status_idx on public.properties (locality_id, status);
create index properties_availability_idx     on public.properties (availability);
create index properties_bhk_idx              on public.properties (bhk);
create index properties_rent_idx             on public.properties (rent);
create index properties_posted_by_idx        on public.properties (posted_by);

create trigger properties_set_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Guard: non-admins may not publish (status=live), moderate (rejected),
-- or forge verification stamps. Keeps the "truth" invariants at the DB layer.
-- ---------------------------------------------------------------------------
create or replace function public.properties_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Trusted contexts pass straight through:
  --   • auth.uid() is null  → direct DB access (migrations, seed, SQL editor) or
  --     the service_role key. End-user anon requests can't reach here at all:
  --     the RLS insert/update policies require posted_by = auth.uid(), which is
  --     null for anon, so RLS rejects them before this trigger runs.
  --   • admins → the moderation role by definition.
  -- What's left is exactly what we mean to constrain: authenticated non-admins.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  -- Only admins can move a listing into a moderation-controlled state.
  if new.status in ('live', 'rejected')
     and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    raise exception 'Only an admin can set listing status to %', new.status
      using errcode = '42501';
  end if;

  -- Only admins can (re)stamp verification.
  if tg_op = 'INSERT' then
    if new.last_verified_at is not null or new.last_verified_by is not null then
      raise exception 'Only an admin can set verification fields' using errcode = '42501';
    end if;
  elsif new.last_verified_at is distinct from old.last_verified_at
     or new.last_verified_by is distinct from old.last_verified_by then
    raise exception 'Only an admin can change verification fields' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger properties_guard_biu
  before insert or update on public.properties
  for each row execute function public.properties_guard();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.properties enable row level security;

-- Read: anyone sees LIVE listings; posters see their own; admin sees all.
create policy properties_select_live_or_own on public.properties
  for select using (
    status = 'live' or posted_by = auth.uid() or public.is_admin()
  );

-- Insert: only owner/broker/admin roles, and only for themselves.
create policy properties_insert_own on public.properties
  for insert with check (
    posted_by = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('owner', 'broker', 'admin')
        and p.is_suspended = false
    )
  );

-- Update: poster edits own; admin edits all. (Status/verification still gated by trigger.)
create policy properties_update_own on public.properties
  for update using (posted_by = auth.uid() or public.is_admin())
  with check (posted_by = auth.uid() or public.is_admin());

create policy properties_delete_own on public.properties
  for delete using (posted_by = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Public read-model: curated projection of LIVE listings only.
-- SECURITY DEFINER view (owned by postgres) so it can compute cross-table
-- aggregates and expose only safe columns to anon/authenticated.
-- (Extended in 0003 to add mismatch warnings.)
-- ---------------------------------------------------------------------------
create or replace view public.v_listings_public as
select
  p.id,
  p.locality_id,
  l.slug              as locality_slug,
  p.title,
  p.description,
  p.address_line,
  p.bhk,
  p.furnishing,
  p.occupancy_pref,
  p.rent,
  p.deposit,
  p.maintenance_monthly,
  p.brokerage,
  p.one_time_charges,
  (p.rent + p.maintenance_monthly)                          as all_in_monthly,
  (p.deposit + p.brokerage + p.one_time_charges)            as move_in_cost,
  p.available_from,
  p.availability,
  p.last_verified_at,
  case
    when p.last_verified_at is null then null
    else floor(extract(epoch from (now() - p.last_verified_at)) / 86400)::int
  end                                                        as days_since_verified,
  (
    p.last_verified_at is null
    or p.last_verified_at < now() - make_interval(days => l.verify_stale_days)
  )                                                          as is_stale,
  poster.role                                                as posted_by_role,
  poster.full_name                                           as posted_by_name,
  p.posted_by,
  p.created_at
from public.properties p
join public.localities l on l.id = p.locality_id
join public.profiles poster on poster.id = p.posted_by
where p.status = 'live';

grant select on public.v_listings_public to anon, authenticated;
