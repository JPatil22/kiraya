-- ============================================================================
-- 0004_broker_suggestions_mvp4.sql — Broker Suggestions via in-app cards (MVP4)
-- Structured, on-platform, referenced-to-a-live-listing suggestions.
-- Also grants brokers read access to anonymised active tenant intents.
-- ============================================================================

create type public.suggestion_status as enum
  ('sent', 'viewed', 'accepted', 'declined', 'not_relevant', 'withdrawn');

create table public.broker_suggestions (
  id               uuid primary key default gen_random_uuid(),
  broker_id        uuid not null references public.profiles (id) on delete cascade,
  tenant_intent_id uuid not null references public.tenant_intents (id) on delete cascade,
  property_id      uuid not null references public.properties (id) on delete cascade,
  message          text check (char_length(message) <= 500),
  status           public.suggestion_status not null default 'sent',
  responded_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- A broker can suggest a given property to a given intent only once.
  unique (tenant_intent_id, property_id)
);

create index broker_suggestions_broker_idx on public.broker_suggestions (broker_id, status);
create index broker_suggestions_intent_idx on public.broker_suggestions (tenant_intent_id, status);

create trigger broker_suggestions_set_updated_at
  before update on public.broker_suggestions
  for each row execute function public.set_updated_at();

-- Stamp responded_at when the tenant transitions the suggestion.
create or replace function public.stamp_suggestion_response()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('viewed', 'accepted', 'declined', 'not_relevant')
     and new.responded_at is null then
    new.responded_at := now();
  end if;
  return new;
end;
$$;

create trigger broker_suggestions_stamp_response
  before update on public.broker_suggestions
  for each row execute function public.stamp_suggestion_response();

alter table public.broker_suggestions enable row level security;

-- Read: the broker who sent it, the tenant who owns the target intent, or admin.
create policy suggestions_select on public.broker_suggestions
  for select using (
    broker_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.tenant_intents ti
               where ti.id = tenant_intent_id and ti.tenant_id = auth.uid())
  );

-- Insert: an active (non-suspended) broker, referencing a LIVE listing and an
-- ACTIVE intent. This is the "must reference a real verified listing" rule.
create policy suggestions_insert_broker on public.broker_suggestions
  for insert with check (
    broker_id = auth.uid()
    and exists (select 1 from public.profiles p
                where p.id = auth.uid() and p.role = 'broker' and p.is_suspended = false)
    and exists (select 1 from public.properties pr
                where pr.id = property_id and pr.status = 'live')
    and exists (select 1 from public.tenant_intents ti
                where ti.id = tenant_intent_id and ti.status = 'active')
  );

-- Update: broker (withdraw) or the target tenant (respond) or admin.
create policy suggestions_update on public.broker_suggestions
  for update using (
    broker_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.tenant_intents ti
               where ti.id = tenant_intent_id and ti.tenant_id = auth.uid())
  )
  with check (
    broker_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.tenant_intents ti
               where ti.id = tenant_intent_id and ti.tenant_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Brokers may now read ACTIVE intents in their own locality (no PII in the
-- table; contact stays in profiles, which brokers cannot read). Deferred here
-- from 0001 because it belongs to the MVP4 capability.
-- ---------------------------------------------------------------------------
create policy intents_select_broker on public.tenant_intents
  for select using (
    status = 'active'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'broker'
        and p.is_suspended = false
        and p.active_locality_id = tenant_intents.locality_id
    )
  );
