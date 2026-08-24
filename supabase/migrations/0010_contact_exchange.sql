-- ---------------------------------------------------------------------------
-- 0010 — Contact exchange
--
-- The gap this closes: a tenant could browse a perfectly verified listing and
-- then reach a dead end. Nothing in the product connected the two people. Every
-- truth signal built so far — freshness, itemised cost, room coverage, change
-- history — exists to make one moment trustworthy, and that moment did not
-- exist.
--
-- Shape (chosen deliberately, see the note on notifications below):
--   • A tenant enquires. Both sides get each other's number in the same
--     instant — the owner's shown on the page, the tenant's on the owner's
--     dashboard. Nothing waits on an approval, because there is no notification
--     channel yet: anything needing an owner to act first would simply rot.
--   • Every exchange is a row. Who, on what, when, and what they said. That is
--     the audit trail that makes bulk number-harvesting visible rather than
--     silent, and it doubles as the owner's lead list.
--   • `profiles` stays locked down. Rather than copy phone numbers into this
--     table, an additive SELECT policy lets the two parties of an exchange read
--     each other — one source of truth, and revoking an exchange revokes the
--     visibility with it.
-- ---------------------------------------------------------------------------

create type public.contact_source as enum ('listing', 'suggestion');

create table public.contact_exchanges (
  id              uuid primary key default gen_random_uuid(),
  property_id     uuid not null references public.properties (id) on delete cascade,
  tenant_id       uuid not null references public.profiles (id) on delete cascade,
  -- Whoever the tenant is now able to phone: the poster, or the broker whose
  -- suggestion they accepted.
  counterparty_id uuid not null references public.profiles (id) on delete cascade,
  source          public.contact_source not null default 'listing',
  message         text check (char_length(message) <= 500),
  created_at      timestamptz not null default now(),

  -- Asking twice is the same lead, not a new one. Scoped by counterparty so a
  -- direct enquiry and a broker's suggestion on the same flat stay distinct.
  unique (tenant_id, property_id, counterparty_id),
  constraint contact_exchanges_not_self check (tenant_id <> counterparty_id)
);

create index contact_exchanges_counterparty_idx
  on public.contact_exchanges (counterparty_id, created_at desc);
create index contact_exchanges_tenant_idx
  on public.contact_exchanges (tenant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Guard: the counterparty must be someone this listing actually entitles you
-- to reach. Without this, the insert policy alone would let a tenant name any
-- profile they liked as the "counterparty" and read that person's number.
-- ---------------------------------------------------------------------------
create or replace function public.contact_exchanges_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  poster uuid;
begin
  select posted_by into poster from public.properties where id = new.property_id;

  if poster is null then
    raise exception 'That listing does not exist' using errcode = '23503';
  end if;

  if new.source = 'listing' then
    if new.counterparty_id <> poster then
      raise exception 'Contact for a listing goes to whoever posted it'
        using errcode = '42501';
    end if;
  else
    -- A suggestion exchange is only legitimate if that broker really did
    -- suggest this property to this tenant, and the tenant accepted it.
    if not exists (
      select 1
      from public.broker_suggestions bs
      join public.tenant_intents ti on ti.id = bs.tenant_intent_id
      where bs.property_id   = new.property_id
        and bs.broker_id     = new.counterparty_id
        and ti.tenant_id     = new.tenant_id
        and bs.status        = 'accepted'
    ) then
      raise exception 'No accepted suggestion links you to that broker'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger contact_exchanges_guard_bi
  before insert on public.contact_exchanges
  for each row execute function public.contact_exchanges_guard();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.contact_exchanges enable row level security;

-- Both parties see the exchange; nobody else does.
create policy contact_exchanges_select_own on public.contact_exchanges
  for select using (
    tenant_id = auth.uid() or counterparty_id = auth.uid() or public.is_admin()
  );

-- Only the tenant initiates, only for themselves, and only on a live listing
-- that isn't their own. The trigger above then checks who they're reaching.
create policy contact_exchanges_insert_own on public.contact_exchanges
  for insert with check (
    tenant_id = auth.uid()
    and exists (
      select 1 from public.properties p
      where p.id = property_id
        and p.status = 'live'
        and p.posted_by <> auth.uid()
    )
  );

-- No update policy on purpose: an exchange is a fact that happened. Correcting
-- history is not a thing either side gets to do.

create policy contact_exchanges_delete_admin on public.contact_exchanges
  for delete using (public.is_admin());

-- ---------------------------------------------------------------------------
-- The point of all of it: the two parties can now read each other's profile.
-- Additive to `profiles_select_self` (policies OR together), so this widens
-- visibility by exactly one relationship and nothing else.
-- ---------------------------------------------------------------------------
create policy profiles_select_contact_exchanged on public.profiles
  for select using (
    exists (
      select 1 from public.contact_exchanges ce
      where (ce.tenant_id = auth.uid() and ce.counterparty_id = profiles.id)
         or (ce.counterparty_id = auth.uid() and ce.tenant_id = profiles.id)
    )
  );
