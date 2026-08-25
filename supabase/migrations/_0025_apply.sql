-- ============================================================================
-- Kiraya - migration 0025.
--
--   0025  THE CLOCK: two scheduled jobs, because nothing in this product has
--         ever fired because a date arrived. One nudges posters whose listings
--         are about to go stale (once per verification cycle, not daily); one
--         reminds both sides of a viewing happening within the day. Also fixes
--         0020's visit notice, which printed UTC to a Pune audience.
--
-- Your database already has 0001-0024. Paste into the Supabase SQL editor and
-- Run. Safe to run more than once.
--
-- Two things to expect:
--
--   1. If pg_cron is not enabled on this project, the final block reports a
--      WARNING and everything else still applies. Enable it under
--      Database -> Extensions and re-run this file to install the schedule.
--   2. If Postgres objects to ALTER TYPE ... ADD VALUE running inside a
--      transaction, run just the two `alter type public.notification_kind`
--      lines below on their own first, then run the rest of the file.
--
-- After it applies, prove the jobs work without waiting for tomorrow:
--
--   select public.run_verification_due();   -- returns how many were nudged
--   select public.run_visit_reminders();
--
-- and check they are registered:
--
--   select jobname, schedule from cron.job where jobname like 'kiraya-%';
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0025 — The clock
--
-- Everything automatic in this product so far happens because somebody wrote a
-- row. Twenty-four migrations of triggers, and not one of them fires because a
-- date arrived. Freshness, meanwhile, is a fact entirely about time passing.
--
-- So a listing verified on the 18th silently crosses the staleness window on
-- the 25th: tenants start seeing "last verified 7 days ago", it sinks in the
-- freshness sort, and the person who could fix it in one tap is told nothing,
-- because nothing was written. The PRD targets >85% of live listings verified
-- inside the window and the only mechanism behind that number is a poster
-- spontaneously coming back.
--
-- Two jobs, both written the way this codebase already writes notifications —
-- in SQL, by the database, with the body frozen at insert time.
--
-- ## Functions first, scheduling second
--
-- `run_verification_due()` and `run_visit_reminders()` are ordinary functions
-- that return how many notices they wrote. They are idempotent, they can be
-- called by hand, and nothing about them needs pg_cron to be true. The cron
-- registration at the bottom is a separate, failure-tolerant step: if the
-- extension cannot be created the migration still lands and says so, and an
-- external caller (or a hand-run `select public.run_verification_due();`) does
-- the same work. The clock is the schedule; the jobs are the product.
--
-- ## Not nagging
--
-- The verification nudge fires once per verification cycle, and needs no state
-- column to do it: a poster is eligible only when no `verification_due` notice
-- exists that is newer than the listing's own `last_verified_at`. Confirming
-- moves that timestamp past the last notice, which makes them eligible again
-- next cycle, and nothing else does. Visit reminders stamp `visits.reminded_at`
-- instead, because a visit is a single event rather than a repeating cycle.
--
-- ## Timezone
--
-- Kiraya is a Pune product and cron speaks UTC, so 08:00 IST is '30 2 * * *'.
-- The same reasoning fixes something 0020 got wrong: it formatted the visit
-- time with no zone at all, which renders UTC — a viewing agreed for 6pm read
-- as 12:30pm in the notification. That was survivable while one message said
-- it; the moment a reminder repeats the time back, the two disagree. Both now
-- print Asia/Kolkata.
-- ---------------------------------------------------------------------------

-- Enum values must be added in their own statements and cannot be *used* until
-- the transaction that adds them commits. Nothing below uses them at migration
-- time — the function bodies only resolve these literals when they run.
alter type public.notification_kind add value if not exists 'verification_due';
alter type public.notification_kind add value if not exists 'visit_reminder';

alter table public.visits
  add column if not exists reminded_at timestamptz;

comment on column public.visits.reminded_at is
  'When the day-before reminder was sent. Null means unsent; a reschedule should clear it.';

-- ---------------------------------------------------------------------------
-- Job 1 — listings that need confirming
--
-- Catches three states in one pass, and says something different about each,
-- because "never confirmed" and "stale since Tuesday" are not the same news:
--   • live and never verified
--   • already past the locality's window
--   • crossing it within the next day
-- ---------------------------------------------------------------------------
create or replace function public.run_verification_due()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r     record;
  sent  int := 0;
  age   int;
begin
  for r in
    select
      p.id,
      p.title,
      p.posted_by,
      p.last_verified_at,
      l.verify_stale_days
    from public.properties p
    join public.localities l on l.id = p.locality_id
    where p.status = 'live'
      and (
        p.last_verified_at is null
        -- One day short of the window: nudged before it goes stale, not after.
        or p.last_verified_at < now() - make_interval(days => greatest(l.verify_stale_days - 1, 0))
      )
      and not exists (
        select 1
        from public.notifications n
        where n.user_id = p.posted_by
          and n.property_id = p.id
          and n.kind = 'verification_due'
          and n.created_at > coalesce(p.last_verified_at, '-infinity'::timestamptz)
      )
  loop
    age := case
      when r.last_verified_at is null then null
      else floor(extract(epoch from (now() - r.last_verified_at)) / 86400)::int
    end;

    perform public.notify(
      r.posted_by,
      'verification_due',
      case
        when age is null then
          '"' || r.title || '" has never been confirmed, and tenants are told so. One tap fixes it.'
        when age >= r.verify_stale_days then
          '"' || r.title || '" is stale — tenants see it was last confirmed ' || age || ' days ago.'
        else
          '"' || r.title || '" goes stale tomorrow. Confirm it is still available.'
      end,
      r.id
    );
    sent := sent + 1;
  end loop;

  return sent;
end;
$$;

-- ---------------------------------------------------------------------------
-- Job 2 — viewings happening tomorrow
--
-- Both sides, because a viewing nobody turns up to wastes two people. Only
-- confirmed slots: a proposal nobody answered is not an appointment, and
-- reminding someone about it would be pretending it was.
-- ---------------------------------------------------------------------------
create or replace function public.run_visit_reminders()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r    record;
  sent int := 0;
  when_text text;
begin
  for r in
    select v.id, v.tenant_id, v.host_id, v.property_id, v.scheduled_for, p.title
    from public.visits v
    join public.properties p on p.id = v.property_id
    where v.status = 'confirmed'
      and v.reminded_at is null
      and v.scheduled_for > now()
      and v.scheduled_for <= now() + interval '24 hours'
  loop
    when_text := to_char(
      r.scheduled_for at time zone 'Asia/Kolkata',
      'FMDay FMDD Mon at FMHH12:MIam'
    );

    perform public.notify(
      r.tenant_id, 'visit_reminder',
      'Viewing "' || coalesce(r.title, 'a listing') || '" ' || when_text || '.',
      r.property_id
    );
    perform public.notify(
      r.host_id, 'visit_reminder',
      'Someone is coming to see "' || coalesce(r.title, 'your listing') || '" ' || when_text || '.',
      r.property_id
    );

    -- Only reminded_at moves, and notify_visit() ignores updates that don't
    -- change status, so stamping this does not announce a status change.
    update public.visits set reminded_at = now() where id = r.id;
    sent := sent + 1;
  end loop;

  return sent;
end;
$$;

-- ---------------------------------------------------------------------------
-- 0020's visit notice, in the reader's timezone
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
        to_char(new.scheduled_for at time zone 'Asia/Kolkata', 'FMDay FMDD Mon at FMHH12:MIam'),
      new.property_id
    );

  elsif new.status is distinct from old.status then
    target := case
      -- Only the other side can confirm or decline, so the proposer is the one
      -- waiting to hear. True regardless of who the session says is acting.
      when new.status in ('confirmed', 'declined') then new.proposed_by
      -- Either party may cancel; use the session when we have one.
      when auth.uid() = new.tenant_id then new.host_id
      when auth.uid() = new.host_id   then new.tenant_id
      else new.proposed_by
    end;

    perform public.notify(
      target, 'visit_answered',
      'A visit to "' || coalesce(title, 'a listing') || '" was ' || new.status::text,
      new.property_id
    );
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Nobody but the scheduler runs these
--
-- Both are SECURITY DEFINER and write notifications for other people, which is
-- exactly what a signed-in user must not be able to do on demand. Postgres
-- grants EXECUTE to PUBLIC by default, so a tenant could otherwise call these
-- straight through PostgREST and spray notices across the locality.
--
-- Revoking is not enough on its own: `service_role` bypasses RLS but NOT
-- grants, so without the explicit grant below the only thing left that could
-- run these would be cron, and the documented fallback — an external caller, or
-- running them by hand — would fail with a permission error.
-- ---------------------------------------------------------------------------
revoke all on function public.run_verification_due() from public, anon, authenticated;
revoke all on function public.run_visit_reminders() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.run_verification_due() to service_role;
    grant execute on function public.run_visit_reminders() to service_role;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- The schedule
--
-- Wrapped so that a project without pg_cron still gets the jobs above. If this
-- block reports that it could not schedule, enable pg_cron in the Supabase
-- dashboard (Database → Extensions) and re-run this file.
-- ---------------------------------------------------------------------------
do $$
begin
  execute 'create extension if not exists pg_cron';

  -- Re-running must not stack duplicate jobs.
  perform cron.unschedule(jobname)
  from cron.job
  where jobname in ('kiraya-verification-due', 'kiraya-visit-reminders');

  -- 08:00 and 08:15 Asia/Kolkata. pg_cron speaks UTC.
  perform cron.schedule(
    'kiraya-verification-due', '30 2 * * *',
    'select public.run_verification_due()'
  );
  perform cron.schedule(
    'kiraya-visit-reminders', '45 2 * * *',
    'select public.run_visit_reminders()'
  );

  raise notice 'Kiraya: scheduled kiraya-verification-due and kiraya-visit-reminders (08:00/08:15 IST).';
exception
  when others then
    raise warning 'Kiraya: jobs installed but NOT scheduled (%). Enable pg_cron in Database → Extensions and re-run this file. Until then call select public.run_verification_due(); and select public.run_visit_reminders(); on a schedule of your own.', sqlerrm;
end;
$$;
