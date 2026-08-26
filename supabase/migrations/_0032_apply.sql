-- ============================================================================
-- Kiraya - migration 0032.
--
--   0032  DEPOSIT CONTEXT: v_listing_deposit_context - the deposit expressed in
--         months of rent, against the median for comparable live listings.
--         Months, not rupees, because a rupee figure is not comparable across a
--         price range. Same rules as 0016: median not mean, the listing
--         excluded from its own comparison, rented excluded, silent below three.
--
-- Your database already has 0001-0031. Paste into the Supabase SQL editor and
-- Run. Safe to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0032 — Is that deposit normal?
--
-- 0016 answered "is this a fair rent" and stopped there, which left the larger
-- number unexamined. A Pune deposit runs anywhere from two months to ten, it is
-- the biggest single amount a tenant hands over, and it is the one figure they
-- have no way to sanity-check. Ask three people what a normal deposit is and
-- you get three answers, all confident.
--
-- ## In months, not rupees
--
-- ₹1,50,000 means nothing on its own — it is generous against a ₹50,000 flat
-- and punitive against a ₹15,000 one. Deposits are negotiated, quoted and
-- complained about in *months of rent*, so that is what this computes and what
-- the UI says. It also makes the comparison valid across a price range, which a
-- rupee median would not be.
--
-- Everything else follows 0016 exactly, for the same reasons it gave:
--
--   * median rather than mean, because one landlord asking ten months would
--     drag an average enough to make six look reasonable;
--   * the listing excluded from its own comparison, since including it pulls
--     the median toward the number being judged — worst where samples are
--     smallest, which is where this launches;
--   * rented listings excluded, because a let flat's terms are history;
--   * silent below three comparables, as a confident median drawn from two is
--     not information.
-- ---------------------------------------------------------------------------

create or replace view public.v_listing_deposit_context as
select
  p.id                                     as property_id,
  p.deposit,
  round(p.deposit::numeric / nullif(p.rent, 0), 1) as months,
  ctx.sample,
  round(ctx.median_months::numeric, 1)     as median_months
from public.properties p
cross join lateral (
  select
    count(*)::int as sample,
    percentile_cont(0.5) within group (
      order by o.deposit::numeric / nullif(o.rent, 0)
    ) as median_months
  from public.properties o
  where o.status = 'live'
    and o.availability <> 'rented'
    and o.locality_id = p.locality_id
    and o.bhk = p.bhk
    and o.id <> p.id
    -- A zero-rent row would divide by null and poison the median.
    and o.rent > 0
) ctx
where p.status = 'live'
  and p.rent > 0;

comment on view public.v_listing_deposit_context is
  'Deposit as months of rent, against the median for comparable live listings. Months because rupees are not comparable across a price range.';

grant select on public.v_listing_deposit_context to anon, authenticated;
