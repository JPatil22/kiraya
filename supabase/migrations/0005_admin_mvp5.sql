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
