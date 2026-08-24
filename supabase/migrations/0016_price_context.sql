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
