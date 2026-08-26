-- ============================================================================
-- Kiraya - migration 0031.
--
--   0031  PUBLIC ACCURACY: v_listing_accuracy_public - the post-visit tally a
--         tenant sees. Counts only, never who; nothing below three answers;
--         live listings only. The per-row feedback in visit_feedback stays as
--         private as 0015 made it.
--
-- Your database already has 0001-0030. Paste into the Supabase SQL editor and
-- Run. Safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0031 — What happened to the people who actually went
--
-- 0015 started asking tenants, three days after they got somebody's number,
-- whether they went and whether it matched. Four buttons, no typing. The
-- answers have been accumulating ever since in `v_listing_accuracy` and are
-- rendered in exactly zero components.
--
-- It is the strongest signal this product has and the only one a competitor
-- cannot copy by copying a screen: it requires the contact exchange to know who
-- enquired, the visit record to know a viewing happened, and the follow-up to
-- catch the answer. Photos, maps, filters and "verified" badges are all
-- available to anyone with a budget. This is not.
--
-- ## Why a second view rather than a grant on the first
--
-- 0015 deliberately kept feedback closed: `visit_feedback_select_own` lets the
-- tenant who answered read their row, and admins read all. Widening a policy
-- later is one line; narrowing it after people have answered under one
-- expectation is not, so it was left shut until there was a reason.
--
-- This is the reason, but not for the rows — only for a tally over them. So the
-- original view stays exactly as restricted as it was, and a separate public
-- view exposes counts under three rules:
--
--   1. **Counts only, never who.** Same promise 0017 makes for engagement.
--   2. **Nothing below three answers.** A "1 of 1 said it didn't match" is not a
--      pattern, it is one bad afternoon, and publishing it would let a single
--      annoyed visitor brand a listing. Same threshold, and the same reasoning,
--      as the price comparison in 0016.
--   3. **"Didn't go" is excluded from the denominator**, as it always has been.
--      Somebody who never visited has said nothing about the flat.
--
-- `unreachable` is kept and counted against the listing on purpose. A poster who
-- never answers their phone is a real failure of what this product promises, not
-- a neutral outcome.
-- ---------------------------------------------------------------------------

create or replace view public.v_listing_accuracy_public as
select
  a.property_id,
  a.answered,
  a.matched,
  a.mismatched,
  a.unreachable,
  round((a.matched::numeric / nullif(a.answered, 0)) * 100)::int as pct_matched
from public.v_listing_accuracy a
join public.properties p on p.id = a.property_id
where a.answered >= 3
  -- Only for listings a tenant can actually see. A tally is not a reason to
  -- leak the existence of a listing that is still in review.
  and p.status = 'live';

comment on view public.v_listing_accuracy_public is
  'Aggregate post-visit outcomes, three answers minimum, counts only. The per-row feedback in visit_feedback stays private to whoever gave it.';

grant select on public.v_listing_accuracy_public to anon, authenticated;
