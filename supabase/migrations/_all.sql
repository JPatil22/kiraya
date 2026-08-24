-- ============================================================================
-- Kiraya — all migrations, concatenated in order for a one-shot paste into
-- the Supabase SQL editor (Project -> SQL Editor -> New query -> Run).
-- Generated from supabase/migrations/. Safe to run once on a fresh project.
-- ============================================================================

-- >>> 0001_core_mvp1.sql ------------------------------------------

-- ============================================================================
-- 0001_core_mvp1.sql — Identity & Intent (MVP1)
-- profiles, localities, tenant_intents + enums + RLS + onboarding plumbing.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role       as enum ('tenant', 'owner', 'broker', 'admin');
create type public.onboarding_step as enum ('role', 'intent', 'done');
create type public.bhk_type        as enum ('1rk', '1bhk', '2bhk', '3bhk', '4plus');
create type public.furnishing_type as enum ('unfurnished', 'semi', 'full');
create type public.occupancy_type  as enum ('family', 'bachelors_male', 'bachelors_female', 'any');
create type public.intent_status   as enum ('active', 'paused', 'fulfilled');

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------
-- Bump updated_at on any row update.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- localities — the platform serves ONE at a time, but the table lets us pin
-- config (staleness window) and, later, expand.
-- ---------------------------------------------------------------------------
create table public.localities (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  name              text not null,
  city              text not null,
  state             text,
  verify_stale_days int  not null default 7 check (verify_stale_days between 1 and 90),
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- profiles — 1:1 with auth.users. `role` is null until the user picks one.
-- `onboarding_step` is the state machine the middleware routes on.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  phone              text,
  full_name          text,
  role               public.user_role,
  onboarding_step    public.onboarding_step not null default 'role',
  active_locality_id uuid references public.localities (id),
  is_suspended       boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Admin check used across every policy. SECURITY DEFINER + owned by postgres
-- so it bypasses RLS on profiles (no recursive policy evaluation).
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Auto-create a profile whenever a new auth user is created (phone signup).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, phone)
  values (new.id, new.phone)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- tenant_intents — the structured demand signal (MVP1 core deliverable).
-- Budget in integer rupees. No contact info here; PII stays in profiles.
-- ---------------------------------------------------------------------------
create table public.tenant_intents (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.profiles (id) on delete cascade,
  locality_id  uuid not null references public.localities (id),
  budget_min   int  not null check (budget_min >= 0),
  budget_max   int  not null check (budget_max >= budget_min),
  bhk          public.bhk_type not null,
  move_in_date date not null,
  furnishing   public.furnishing_type not null default 'semi',
  occupancy    public.occupancy_type  not null default 'any',
  notes        text check (char_length(notes) <= 500),
  status       public.intent_status   not null default 'active',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index tenant_intents_tenant_idx   on public.tenant_intents (tenant_id);
create index tenant_intents_locality_idx on public.tenant_intents (locality_id, status);

create trigger tenant_intents_set_updated_at
  before update on public.tenant_intents
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.localities     enable row level security;
alter table public.profiles       enable row level security;
alter table public.tenant_intents enable row level security;

-- localities: world-readable reference data; admin writes.
create policy localities_read_all on public.localities
  for select using (true);
create policy localities_admin_write on public.localities
  for all using (public.is_admin()) with check (public.is_admin());

-- profiles: read/insert/update self; admin everything.
create policy profiles_select_self on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy profiles_insert_self on public.profiles
  for insert with check (id = auth.uid());
-- Users may edit themselves but may NOT self-promote to admin.
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (
    public.is_admin()
    or (id = auth.uid() and role is distinct from 'admin')
  );

-- tenant_intents: owner tenant + admin (broker read is added in 0004).
create policy intents_select_own on public.tenant_intents
  for select using (tenant_id = auth.uid() or public.is_admin());
create policy intents_insert_own on public.tenant_intents
  for insert with check (tenant_id = auth.uid());
create policy intents_update_own on public.tenant_intents
  for update using (tenant_id = auth.uid() or public.is_admin())
  with check (tenant_id = auth.uid() or public.is_admin());
create policy intents_delete_own on public.tenant_intents
  for delete using (tenant_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Seed the launch locality (matches NEXT_PUBLIC_ACTIVE_LOCALITY_SLUG).
-- ---------------------------------------------------------------------------
insert into public.localities (slug, name, city, state, verify_stale_days)
values ('hsr-layout', 'HSR Layout', 'Bengaluru', 'Karnataka', 7)
on conflict (slug) do nothing;

-- >>> 0002_listings_mvp2.sql --------------------------------------

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

-- >>> 0003_history_mismatch_mvp3.sql ------------------------------

-- ============================================================================
-- 0003_history_mismatch_mvp3.sql — History & Mismatch Warnings (MVP3)
-- Append-only property_updates (auto via trigger) + tenant mismatch_reports.
-- Extends v_listings_public with an open-mismatch warning.
-- ============================================================================

create type public.update_kind   as enum ('price', 'availability', 'terms', 'verification', 'other');
create type public.mismatch_type as enum
  ('price_higher', 'already_rented', 'wrong_furnishing', 'wrong_details', 'unreachable', 'other');
create type public.report_status as enum ('open', 'resolved', 'dismissed');

-- ---------------------------------------------------------------------------
-- property_updates — append-only audit log (the "update history" feature).
-- ---------------------------------------------------------------------------
create table public.property_updates (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  changed_by  uuid references public.profiles (id),
  field       text not null,
  old_value   text,
  new_value   text,
  kind        public.update_kind not null default 'other',
  created_at  timestamptz not null default now()
);

create index property_updates_property_idx on public.property_updates (property_id, created_at desc);

-- Log every meaningful change to a property. AFTER UPDATE; runs as definer so
-- the append always succeeds regardless of the caller's RLS on this table.
create or replace function public.log_property_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
begin
  -- price components
  if new.rent is distinct from old.rent then
    insert into public.property_updates(property_id, changed_by, field, old_value, new_value, kind)
    values (new.id, actor, 'rent', old.rent::text, new.rent::text, 'price');
  end if;
  if new.deposit is distinct from old.deposit then
    insert into public.property_updates(property_id, changed_by, field, old_value, new_value, kind)
    values (new.id, actor, 'deposit', old.deposit::text, new.deposit::text, 'price');
  end if;
  if new.maintenance_monthly is distinct from old.maintenance_monthly then
    insert into public.property_updates(property_id, changed_by, field, old_value, new_value, kind)
    values (new.id, actor, 'maintenance_monthly', old.maintenance_monthly::text, new.maintenance_monthly::text, 'price');
  end if;
  if new.brokerage is distinct from old.brokerage then
    insert into public.property_updates(property_id, changed_by, field, old_value, new_value, kind)
    values (new.id, actor, 'brokerage', old.brokerage::text, new.brokerage::text, 'price');
  end if;
  if new.one_time_charges is distinct from old.one_time_charges then
    insert into public.property_updates(property_id, changed_by, field, old_value, new_value, kind)
    values (new.id, actor, 'one_time_charges', old.one_time_charges::text, new.one_time_charges::text, 'price');
  end if;

  -- availability
  if new.availability is distinct from old.availability then
    insert into public.property_updates(property_id, changed_by, field, old_value, new_value, kind)
    values (new.id, actor, 'availability', old.availability::text, new.availability::text, 'availability');
  end if;
  if new.available_from is distinct from old.available_from then
    insert into public.property_updates(property_id, changed_by, field, old_value, new_value, kind)
    values (new.id, actor, 'available_from', old.available_from::text, new.available_from::text, 'availability');
  end if;

  -- terms
  if new.furnishing is distinct from old.furnishing then
    insert into public.property_updates(property_id, changed_by, field, old_value, new_value, kind)
    values (new.id, actor, 'furnishing', old.furnishing::text, new.furnishing::text, 'terms');
  end if;
  if new.occupancy_pref is distinct from old.occupancy_pref then
    insert into public.property_updates(property_id, changed_by, field, old_value, new_value, kind)
    values (new.id, actor, 'occupancy_pref', old.occupancy_pref::text, new.occupancy_pref::text, 'terms');
  end if;

  -- verification + status
  if new.last_verified_at is distinct from old.last_verified_at then
    insert into public.property_updates(property_id, changed_by, field, old_value, new_value, kind)
    values (new.id, actor, 'last_verified_at', old.last_verified_at::text, new.last_verified_at::text, 'verification');
  end if;
  if new.status is distinct from old.status then
    insert into public.property_updates(property_id, changed_by, field, old_value, new_value, kind)
    values (new.id, actor, 'status', old.status::text, new.status::text, 'other');
  end if;

  return null; -- AFTER trigger; return value ignored
end;
$$;

create trigger properties_log_changes_au
  after update on public.properties
  for each row execute function public.log_property_changes();

alter table public.property_updates enable row level security;

-- Readable by anyone who can see the underlying property (transparency).
create policy property_updates_select on public.property_updates
  for select using (
    exists (
      select 1 from public.properties pr
      where pr.id = property_id
        and (pr.status = 'live' or pr.posted_by = auth.uid() or public.is_admin())
    )
  );
-- Manual notes allowed by poster/admin; automatic rows are inserted by the
-- SECURITY DEFINER trigger and bypass this policy.
create policy property_updates_insert on public.property_updates
  for insert with check (
    public.is_admin()
    or exists (select 1 from public.properties pr
               where pr.id = property_id and pr.posted_by = auth.uid())
  );
-- No update/delete policies → append-only.

-- ---------------------------------------------------------------------------
-- mismatch_reports — tenant-reported discrepancies.
-- ---------------------------------------------------------------------------
create table public.mismatch_reports (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  reported_by uuid not null references public.profiles (id) on delete cascade,
  type        public.mismatch_type not null,
  description text check (char_length(description) <= 500),
  status      public.report_status not null default 'open',
  resolved_by uuid references public.profiles (id),
  resolved_at timestamptz,
  created_at  timestamptz not null default now()
);

create index mismatch_reports_property_idx on public.mismatch_reports (property_id, status);
-- One open report per tenant per property.
create unique index mismatch_reports_one_open
  on public.mismatch_reports (property_id, reported_by)
  where status = 'open';

alter table public.mismatch_reports enable row level security;

create policy mismatch_select on public.mismatch_reports
  for select using (
    reported_by = auth.uid()
    or public.is_admin()
    or exists (select 1 from public.properties pr
               where pr.id = property_id and pr.posted_by = auth.uid())
  );
create policy mismatch_insert_own on public.mismatch_reports
  for insert with check (reported_by = auth.uid());
-- Only admins triage (resolve/dismiss).
create policy mismatch_update_admin on public.mismatch_reports
  for update using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Extend the public read-model with a mismatch warning.
-- Warning threshold: >= 2 open reports surfaces a badge to every viewer.
--
-- Dropped and recreated rather than CREATE OR REPLACE: replace can only append
-- columns to the end of a view, and these two land before `created_at`. The
-- grant is reissued below because dropping the view drops its grants too.
-- ---------------------------------------------------------------------------
drop view if exists public.v_listings_public;

create view public.v_listings_public as
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
  (p.rent + p.maintenance_monthly)               as all_in_monthly,
  (p.deposit + p.brokerage + p.one_time_charges) as move_in_cost,
  p.available_from,
  p.availability,
  p.last_verified_at,
  case
    when p.last_verified_at is null then null
    else floor(extract(epoch from (now() - p.last_verified_at)) / 86400)::int
  end                                            as days_since_verified,
  (
    p.last_verified_at is null
    or p.last_verified_at < now() - make_interval(days => l.verify_stale_days)
  )                                              as is_stale,
  poster.role                                    as posted_by_role,
  poster.full_name                               as posted_by_name,
  p.posted_by,
  coalesce(m.open_count, 0)                      as open_mismatch_count,
  (coalesce(m.open_count, 0) >= 2)               as has_warning,
  p.created_at
from public.properties p
join public.localities l on l.id = p.locality_id
join public.profiles poster on poster.id = p.posted_by
left join lateral (
  select count(*)::int as open_count
  from public.mismatch_reports mr
  where mr.property_id = p.id and mr.status = 'open'
) m on true
where p.status = 'live';

grant select on public.v_listings_public to anon, authenticated;

-- >>> 0004_broker_suggestions_mvp4.sql ----------------------------

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

-- >>> 0005_admin_mvp5.sql -----------------------------------------

-- ============================================================================
-- 0005_admin_mvp5.sql — Admin Panel (MVP5)
-- moderation_actions audit trail, admin RPCs (verify/approve/reject/suspend/
-- resolve), and the locality health view.
-- ============================================================================

create type public.moderation_kind as enum (
  'approve', 'reject', 'verify', 'takedown',
  'suspend_user', 'reinstate_user', 'resolve_report', 'dismiss_report'
);

create table public.moderation_actions (
  id           uuid primary key default gen_random_uuid(),
  admin_id     uuid not null references public.profiles (id),
  target_table text not null,
  target_id    uuid not null,
  kind         public.moderation_kind not null,
  note         text check (char_length(note) <= 500),
  created_at   timestamptz not null default now()
);

create index moderation_actions_target_idx on public.moderation_actions (target_table, target_id);
create index moderation_actions_admin_idx  on public.moderation_actions (admin_id, created_at desc);

alter table public.moderation_actions enable row level security;

create policy moderation_admin_all on public.moderation_actions
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Admin RPCs. All are SECURITY DEFINER and self-gate on is_admin(), so they
-- can write across tables (past the guard trigger) but only for real admins.
-- ---------------------------------------------------------------------------

-- Approve a listing and stamp verification in one shot.
create or replace function public.admin_review_listing(
  p_property uuid,
  p_approve  boolean,
  p_note     text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_approve then
    update public.properties
       set status = 'live',
           last_verified_at = now(),
           last_verified_by = auth.uid()
     where id = p_property;
    insert into public.moderation_actions(admin_id, target_table, target_id, kind, note)
    values (auth.uid(), 'properties', p_property, 'approve', p_note);
  else
    update public.properties set status = 'rejected' where id = p_property;
    insert into public.moderation_actions(admin_id, target_table, target_id, kind, note)
    values (auth.uid(), 'properties', p_property, 'reject', p_note);
  end if;
end;
$$;

-- Re-verify a live listing (refresh freshness).
create or replace function public.admin_verify_listing(
  p_property uuid,
  p_note     text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.properties
     set last_verified_at = now(),
         last_verified_by = auth.uid()
   where id = p_property;

  insert into public.moderation_actions(admin_id, target_table, target_id, kind, note)
  values (auth.uid(), 'properties', p_property, 'verify', p_note);
end;
$$;

-- Take a listing down (archive).
create or replace function public.admin_takedown_listing(
  p_property uuid,
  p_note     text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.properties set status = 'archived' where id = p_property;
  insert into public.moderation_actions(admin_id, target_table, target_id, kind, note)
  values (auth.uid(), 'properties', p_property, 'takedown', p_note);
end;
$$;

-- Triage a mismatch report.
create or replace function public.admin_resolve_report(
  p_report  uuid,
  p_resolve boolean,           -- true = resolved, false = dismissed
  p_note    text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.report_status   := case when p_resolve then 'resolved' else 'dismissed' end;
  v_kind   public.moderation_kind := case when p_resolve then 'resolve_report' else 'dismiss_report' end;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.mismatch_reports
     set status = v_status, resolved_by = auth.uid(), resolved_at = now()
   where id = p_report;

  insert into public.moderation_actions(admin_id, target_table, target_id, kind, note)
  values (auth.uid(), 'mismatch_reports', p_report, v_kind, p_note);
end;
$$;

-- Suspend / reinstate a user (broker moderation).
create or replace function public.admin_set_suspended(
  p_user      uuid,
  p_suspended boolean,
  p_note      text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.profiles set is_suspended = p_suspended where id = p_user;
  insert into public.moderation_actions(admin_id, target_table, target_id, kind, note)
  values (auth.uid(), 'profiles', p_user,
          case when p_suspended then 'suspend_user' else 'reinstate_user' end, p_note);
end;
$$;

-- ---------------------------------------------------------------------------
-- Locality health dashboard. security_invoker so admins (who can read all
-- rows) get true totals; RLS still protects non-admins.
-- ---------------------------------------------------------------------------
create or replace view public.v_locality_health
with (security_invoker = true) as
select
  l.id   as locality_id,
  l.slug,
  l.name,
  (select count(*) from public.properties p
     where p.locality_id = l.id and p.status = 'live')                       as live_count,
  (select count(*) from public.properties p
     where p.locality_id = l.id and p.status = 'live'
       and (p.last_verified_at is null
            or p.last_verified_at < now() - make_interval(days => l.verify_stale_days))) as stale_count,
  (select count(*) from public.properties p
     where p.locality_id = l.id and p.status = 'pending_review')             as pending_count,
  (select count(*) from public.properties p
     where p.locality_id = l.id and p.status = 'live'
       and p.availability = 'available')                                     as available_count,
  (select count(*) from public.mismatch_reports mr
     join public.properties p on p.id = mr.property_id
     where p.locality_id = l.id and mr.status = 'open')                      as open_mismatch_count,
  (select count(distinct ti.tenant_id) from public.tenant_intents ti
     where ti.locality_id = l.id and ti.status = 'active')                   as active_tenant_count
from public.localities l;

grant select on public.v_locality_health to authenticated;

-- >>> 0006_listing_photos.sql -------------------------------------

-- ============================================================================
-- 0006_listing_photos.sql — Listing photos
-- A photo is evidence, so it carries its own author and its own capture date:
-- a fresh price next to a two-year-old photo is exactly the mismatch this
-- product exists to surface. Files live in the `listing-photos` bucket.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- property_photos
-- ---------------------------------------------------------------------------
create table public.property_photos (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,

  -- Object key inside the `listing-photos` bucket: "<property_id>/<uuid>.<ext>".
  storage_path text not null unique,
  caption      text check (char_length(caption) <= 140),

  -- Lowest sort_order is the cover shot.
  sort_order   int not null default 0 check (sort_order >= 0),

  -- When the photo was TAKEN, not when it was uploaded. Null = unknown, which
  -- the UI shows as "date not given" rather than pretending it's current.
  captured_at  date,

  created_by   uuid not null references public.profiles (id),
  created_at   timestamptz not null default now()
);

create index property_photos_property_idx on public.property_photos (property_id, sort_order);

-- Cap the gallery. Volume is not the product; eight is plenty for one unit.
create or replace function public.property_photos_limit()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.property_photos where property_id = new.property_id) >= 8 then
    raise exception 'A listing can have at most 8 photos' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger property_photos_limit_bi
  before insert on public.property_photos
  for each row execute function public.property_photos_limit();

-- ---------------------------------------------------------------------------
-- RLS — mirrors properties: visible if the listing is, writable by its poster.
-- ---------------------------------------------------------------------------
alter table public.property_photos enable row level security;

create policy property_photos_select on public.property_photos
  for select using (
    exists (
      select 1 from public.properties pr
      where pr.id = property_id
        and (pr.status = 'live' or pr.posted_by = auth.uid() or public.is_admin())
    )
  );

create policy property_photos_insert on public.property_photos
  for insert with check (
    created_by = auth.uid()
    and (
      public.is_admin()
      or exists (select 1 from public.properties pr
                 where pr.id = property_id and pr.posted_by = auth.uid())
    )
  );

create policy property_photos_update on public.property_photos
  for update using (
    public.is_admin()
    or exists (select 1 from public.properties pr
               where pr.id = property_id and pr.posted_by = auth.uid())
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.properties pr
               where pr.id = property_id and pr.posted_by = auth.uid())
  );

create policy property_photos_delete on public.property_photos
  for delete using (
    public.is_admin()
    or exists (select 1 from public.properties pr
               where pr.id = property_id and pr.posted_by = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Storage bucket. Public read (these are marketing images on a public feed);
-- writes are scoped to the poster of the property named by the first path
-- segment, so nobody can drop files into someone else's listing folder.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-photos',
  'listing-photos',
  true,
  5242880,                                              -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "listing photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'listing-photos');

create policy "posters upload to their own listing folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'listing-photos'
    and (
      public.is_admin()
      or exists (
        select 1 from public.properties pr
        where pr.id = ((storage.foldername(name))[1])::uuid
          and pr.posted_by = auth.uid()
      )
    )
  );

create policy "posters delete from their own listing folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'listing-photos'
    and (
      public.is_admin()
      or exists (
        select 1 from public.properties pr
        where pr.id = ((storage.foldername(name))[1])::uuid
          and pr.posted_by = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Extend the public read-model with the cover shot and its age.
-- `photo_captured_at` is exposed alongside `last_verified_at` on purpose: the
-- feed can then say "verified 2 days ago, photo from 2023" instead of letting
-- a stale image ride on a fresh verification.
--
-- Dropped and recreated for the same reason as 0003: CREATE OR REPLACE can only
-- append columns, and the cover-photo columns land before `created_at`.
-- ---------------------------------------------------------------------------
drop view if exists public.v_listings_public;

create view public.v_listings_public as
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
  (p.rent + p.maintenance_monthly)               as all_in_monthly,
  (p.deposit + p.brokerage + p.one_time_charges) as move_in_cost,
  p.available_from,
  p.availability,
  p.last_verified_at,
  case
    when p.last_verified_at is null then null
    else floor(extract(epoch from (now() - p.last_verified_at)) / 86400)::int
  end                                            as days_since_verified,
  (
    p.last_verified_at is null
    or p.last_verified_at < now() - make_interval(days => l.verify_stale_days)
  )                                              as is_stale,
  poster.role                                    as posted_by_role,
  poster.full_name                               as posted_by_name,
  p.posted_by,
  coalesce(m.open_count, 0)                      as open_mismatch_count,
  (coalesce(m.open_count, 0) >= 2)               as has_warning,
  cover.storage_path                             as cover_photo_path,
  cover.captured_at                              as cover_photo_captured_at,
  coalesce(ph.photo_count, 0)                    as photo_count,
  p.created_at
from public.properties p
join public.localities l on l.id = p.locality_id
join public.profiles poster on poster.id = p.posted_by
left join lateral (
  select count(*)::int as open_count
  from public.mismatch_reports mr
  where mr.property_id = p.id and mr.status = 'open'
) m on true
left join lateral (
  select pp.storage_path, pp.captured_at
  from public.property_photos pp
  where pp.property_id = p.id
  order by pp.sort_order, pp.created_at
  limit 1
) cover on true
left join lateral (
  select count(*)::int as photo_count
  from public.property_photos pp
  where pp.property_id = p.id
) ph on true
where p.status = 'live';

grant select on public.v_listings_public to anon, authenticated;

-- >>> 0007_pune_locality.sql --------------------------------------

-- ============================================================================
-- 0007_pune_locality.sql — Relaunch on Pune
--
-- The launch market moves from HSR Layout (Bengaluru) to Pune. Note that Pune
-- is a CITY being used as a single `locality` row, which is a deliberate
-- departure from the PRD's "win one neighbourhood completely" bet: one
-- staleness window and one undifferentiated feed now span ~500 km². The feed
-- has no geography filter, so a tenant in Kothrud sees Kharadi listings with no
-- way to narrow down. Tracked in docs/ROADMAP.md — add a sub-locality/area
-- dimension before this becomes the thing tenants complain about.
--
-- HSR Layout is deactivated rather than deleted: `properties.locality_id` and
-- `tenant_intents.locality_id` reference it, and history is not ours to erase.
-- ============================================================================

insert into public.localities (slug, name, city, state, verify_stale_days)
values ('pune', 'Pune', 'Pune', 'Maharashtra', 7)
on conflict (slug) do nothing;

update public.localities
   set is_active = false
 where slug = 'hsr-layout';

-- >>> 0008_photo_rooms.sql ----------------------------------------

-- ============================================================================
-- 0008_photo_rooms.sql — Structured photos: one slot per room
--
-- Photos stop being an unlabelled pile. Every photo claims a room, and the set
-- of rooms a listing OWES is derived from its BHK: a 2BHK owes hall, kitchen,
-- bathroom and two bedrooms. One photo per slot, so a listing can't pad itself
-- with eight angles of the same living room and look complete.
--
-- Coverage then becomes a trust signal in its own right, alongside freshness:
-- "4 of 5 rooms shown" tells a tenant what is being left out.
-- ============================================================================

create type public.room_type as enum (
  'hall',       -- living room; for a 1RK this is the room itself
  'kitchen',
  'bedroom',
  'bathroom',
  'balcony',    -- optional extra
  'exterior'    -- optional extra: building, entrance, parking
);

-- ---------------------------------------------------------------------------
-- How many bedrooms a configuration owes. 1RK has none — its `hall` slot is
-- the single room, which is exactly what makes a 1RK a 1RK.
-- ---------------------------------------------------------------------------
create or replace function public.bedrooms_for_bhk(p_bhk public.bhk_type)
returns int
language sql
immutable
as $$
  select case p_bhk
    when '1rk'   then 0
    when '1bhk'  then 1
    when '2bhk'  then 2
    when '3bhk'  then 3
    when '4plus' then 4
  end;
$$;

/** Required slots = hall + kitchen + bathroom + one per bedroom. */
create or replace function public.rooms_required_for_bhk(p_bhk public.bhk_type)
returns int
language sql
immutable
as $$
  select 3 + public.bedrooms_for_bhk(p_bhk);
$$;

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.property_photos
  add column room_type  public.room_type,
  -- Distinguishes "Bedroom 1" from "Bedroom 2". Always 1 for single rooms.
  add column room_index smallint not null default 1 check (room_index between 1 and 4);

-- Existing photos predate slots; park them on the hall so the column can be
-- NOT NULL. There are only demo rows at this point.
update public.property_photos set room_type = 'hall' where room_type is null;

-- Keep the first hall photo per property, retag the rest as exterior so the
-- unique index below can be created without collisions.
with ranked as (
  select id, row_number() over (partition by property_id, room_type, room_index
                                order by sort_order, created_at) as rn
  from public.property_photos
)
update public.property_photos p
   set room_type = 'exterior'
  from ranked r
 where r.id = p.id and r.rn > 1;

alter table public.property_photos alter column room_type set not null;

-- One photo per room slot. This is the rule that stops "random photos".
create unique index property_photos_one_per_room
  on public.property_photos (property_id, room_type, room_index);

-- ---------------------------------------------------------------------------
-- A slot has to make sense for the configuration: no "Bedroom 3" on a 1BHK,
-- and no bedroom at all on a 1RK.
-- ---------------------------------------------------------------------------
create or replace function public.property_photos_room_valid()
returns trigger
language plpgsql
as $$
declare
  v_bhk      public.bhk_type;
  v_bedrooms int;
begin
  select bhk into v_bhk from public.properties where id = new.property_id;
  v_bedrooms := public.bedrooms_for_bhk(v_bhk);

  if new.room_type = 'bedroom' then
    if v_bedrooms = 0 then
      raise exception 'A % has no separate bedroom', v_bhk using errcode = '23514';
    end if;
    if new.room_index > v_bedrooms then
      raise exception 'A % has % bedroom(s); bedroom % does not exist',
        v_bhk, v_bedrooms, new.room_index using errcode = '23514';
    end if;
  elsif new.room_index <> 1 then
    raise exception 'Only bedrooms are numbered' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger property_photos_room_valid_biu
  before insert or update on public.property_photos
  for each row execute function public.property_photos_room_valid();

-- ---------------------------------------------------------------------------
-- Surface coverage on the public read-model. Dropped and recreated because
-- CREATE OR REPLACE can only append columns (see 0003).
-- ---------------------------------------------------------------------------
drop view if exists public.v_listings_public;

create view public.v_listings_public as
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
  (p.rent + p.maintenance_monthly)               as all_in_monthly,
  (p.deposit + p.brokerage + p.one_time_charges) as move_in_cost,
  p.available_from,
  p.availability,
  p.last_verified_at,
  case
    when p.last_verified_at is null then null
    else floor(extract(epoch from (now() - p.last_verified_at)) / 86400)::int
  end                                            as days_since_verified,
  (
    p.last_verified_at is null
    or p.last_verified_at < now() - make_interval(days => l.verify_stale_days)
  )                                              as is_stale,
  poster.role                                    as posted_by_role,
  poster.full_name                               as posted_by_name,
  p.posted_by,
  coalesce(m.open_count, 0)                      as open_mismatch_count,
  (coalesce(m.open_count, 0) >= 2)               as has_warning,
  cover.storage_path                             as cover_photo_path,
  cover.captured_at                              as cover_photo_captured_at,
  coalesce(ph.photo_count, 0)                    as photo_count,
  public.rooms_required_for_bhk(p.bhk)           as rooms_required,
  coalesce(ph.rooms_covered, 0)                  as rooms_covered,
  p.created_at
from public.properties p
join public.localities l on l.id = p.locality_id
join public.profiles poster on poster.id = p.posted_by
left join lateral (
  select count(*)::int as open_count
  from public.mismatch_reports mr
  where mr.property_id = p.id and mr.status = 'open'
) m on true
left join lateral (
  -- The hall leads by default: it's the room a tenant judges first.
  select pp.storage_path, pp.captured_at
  from public.property_photos pp
  where pp.property_id = p.id
  order by (pp.room_type <> 'hall'), pp.sort_order, pp.created_at
  limit 1
) cover on true
left join lateral (
  select
    count(*)::int as photo_count,
    -- Only required slots count toward coverage; balconies don't fill a bedroom.
    count(*) filter (
      where pp.room_type in ('hall', 'kitchen', 'bathroom', 'bedroom')
    )::int as rooms_covered
  from public.property_photos pp
  where pp.property_id = p.id
) ph on true
where p.status = 'live';

grant select on public.v_listings_public to anon, authenticated;
