-- ============================================================================
-- Kiraya — migrations 0016 + 0017.
--   0016  price context (a view; no tables touched)
--   0017  owner reply to mismatch reports + per-listing engagement counts
-- Your database already has 0001–0015. Paste into the Supabase SQL editor and
-- Run. Safe to run once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0016 — Price context
--
-- The product itemises what a flat costs. It has never said whether that cost
-- is normal. A tenant looking at ₹32,000 all-in has no way to know if that's
-- the going rate for a 2BHK here or ₹4,000 over it — which is exactly the
-- judgement the cost breakdown was supposed to enable.
--
-- No new data is needed: every live listing already carries its components.
--
-- ## Two decisions
--
-- Median, not mean. One ₹90,000 penthouse would drag an average enough to make
-- every ordinary flat look cheap, which is the opposite of informative.
--
-- The listing is excluded from its own comparison. Including it pulls the
-- median toward the very number being judged — worst exactly where samples are
-- smallest, which is where this launches. `sample` therefore counts OTHER
-- listings, and the UI stays silent below three of them: with one or two
-- comparables the honest answer is "we don't know yet".
-- ---------------------------------------------------------------------------

create or replace view public.v_listing_price_context as
select
  p.id                                            as property_id,
  (p.rent + p.maintenance_monthly)                as all_in_monthly,
  ctx.sample,
  ctx.median_all_in::int                          as median_all_in,
  case
    when ctx.median_all_in is null or ctx.median_all_in = 0 then null
    else round(
      (((p.rent + p.maintenance_monthly) - ctx.median_all_in) / ctx.median_all_in) * 100
    )::int
  end                                             as pct_vs_median
from public.properties p
cross join lateral (
  select
    count(*)::int as sample,
    percentile_cont(0.5) within group (
      order by (o.rent + o.maintenance_monthly)
    ) as median_all_in
  from public.properties o
  where o.status = 'live'
    -- A rented flat's asking price is history, not the market.
    and o.availability <> 'rented'
    and o.locality_id = p.locality_id
    and o.bhk = p.bhk
    and o.id <> p.id
) ctx
where p.status = 'live';

grant select on public.v_listing_price_context to anon, authenticated;


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
