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
