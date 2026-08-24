-- ---------------------------------------------------------------------------
-- 0017 — Two gaps on the poster's side
--
-- (a) An owner accused of a mismatch had no voice. Two tenants report "price
--     higher", the listing gets a public warning badge, an admin resolves it —
--     and the person it's about cannot say a word. For a product whose whole
--     pitch is accountability, hearing one side is a strange place to stop.
--
-- (b) Owners had no idea whether anything was working. Saves and enquiries are
--     already recorded; they were simply never counted back to the person who
--     posted the listing.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- (a) Owner's reply to a mismatch report
-- ---------------------------------------------------------------------------
alter table public.mismatch_reports
  add column if not exists owner_response     text
    check (char_length(owner_response) <= 1000),
  add column if not exists owner_responded_at timestamptz;

/**
 * The poster may reply, and may edit their reply — nothing else.
 *
 * An RLS policy cannot restrict WHICH columns an update touches, so without
 * this a policy generous enough to allow a reply would also let the accused
 * rewrite the accusation, or close the report against themselves.
 */
create or replace function public.mismatch_reports_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.property_id  is distinct from old.property_id
     or new.reported_by is distinct from old.reported_by
     or new.type        is distinct from old.type
     or new.description is distinct from old.description
     or new.status      is distinct from old.status
     or new.resolved_by is distinct from old.resolved_by
     or new.resolved_at is distinct from old.resolved_at then
    raise exception 'You may only add or edit your reply to this report'
      using errcode = '42501';
  end if;

  -- Stamp the reply time from the server rather than trusting the caller.
  if new.owner_response is distinct from old.owner_response then
    new.owner_responded_at := now();
  end if;

  return new;
end;
$$;

create trigger mismatch_reports_guard_bu
  before update on public.mismatch_reports
  for each row execute function public.mismatch_reports_guard();

-- Only the poster of the reported listing, and only while it's theirs.
create policy mismatch_reports_reply_own on public.mismatch_reports
  for update using (
    exists (
      select 1 from public.properties p
      where p.id = mismatch_reports.property_id and p.posted_by = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.properties p
      where p.id = mismatch_reports.property_id and p.posted_by = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- (b) Engagement per listing
--
-- Counts only — never who. A shortlist is private (0011) and turning it into a
-- lead list would break that promise; contact exchange is the deliberate,
-- recorded step where a tenant chooses to be known.
--
-- This view intentionally reads through the owner's RLS on `shortlists`, which
-- would return nothing, so it is defined to run with the view owner's rights
-- (the default for views here) and filters to the poster itself.
-- ---------------------------------------------------------------------------
create or replace view public.v_listing_engagement as
select
  p.id                                   as property_id,
  p.posted_by,
  coalesce(s.saves, 0)                   as saves,
  coalesce(c.enquiries, 0)               as enquiries,
  coalesce(f.answered, 0)                as visits_answered
from public.properties p
left join lateral (
  select count(*)::int as saves
  from public.shortlists sl where sl.property_id = p.id
) s on true
left join lateral (
  select count(*)::int as enquiries
  from public.contact_exchanges ce where ce.property_id = p.id
) c on true
left join lateral (
  select count(*)::int as answered
  from public.visit_feedback vf
  where vf.property_id = p.id and vf.outcome <> 'did_not_visit'
) f on true
where p.posted_by = auth.uid() or public.is_admin();

grant select on public.v_listing_engagement to authenticated;
