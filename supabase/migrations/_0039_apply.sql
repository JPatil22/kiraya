-- ============================================================================
-- _0039_apply.sql — paste this into the Supabase SQL editor.
--
-- Idempotent: rebuilds v_listings_public to add one trailing column,
--   last_activity_at = coalesce(last_verified_at, created_at)
-- so the feed can rank by "most recently active" instead of "most recently
-- verified". Safe to run more than once: `drop view if exists` + recreate
-- no-ops on a second run.
--
-- Why: every Facebook-sourced listing is never-verified, so the old
-- `last_verified_at desc, nulls last` sort buried all imported supply at the
-- bottom of the last page. last_activity_at lets a brand-new listing rank by
-- when it was posted while a recently-verified one still ranks by verification.
-- Trust signals (last_verified_at, days_since_verified, is_stale) are unchanged.
--
-- Apply this BEFORE the code that reads the column ships: the feed query orders
-- by last_activity_at, and PostgREST errors if the column is missing. Definition
-- is 0035's, verbatim, plus the trailing column.
-- ============================================================================
drop view if exists public.v_listings_public;

create view public.v_listings_public as
select
  p.id,
  p.locality_id,
  l.slug              as locality_slug,
  p.area_id,
  ar.slug             as area_slug,
  ar.name             as area_name,
  p.latitude,
  p.longitude,
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
  p.brokerage_disclosed,
  p.one_time_charges,
  (p.rent + p.maintenance_monthly)               as all_in_monthly,
  (p.deposit + p.brokerage + p.one_time_charges) as move_in_cost,
  p.available_from,
  p.availability,
  p.last_verified_at,
  (p.last_verified_by is not null and p.last_verified_by = p.posted_by)
                                                 as verified_by_poster,
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
  src.source_name                                as sourced_broker_name,
  coalesce(m.open_count, 0)                      as open_mismatch_count,
  (coalesce(m.open_count, 0) >= 2)               as has_warning,
  cover.storage_path                             as cover_photo_path,
  cover.thumbnail_path                           as cover_photo_thumb_path,
  cover.captured_at                              as cover_photo_captured_at,
  coalesce(ph.photo_count, 0)                    as photo_count,
  public.rooms_required_for_bhk(p.bhk)           as rooms_required,
  coalesce(ph.rooms_covered, 0)                  as rooms_covered,
  p.created_at,
  -- Freshness for ranking: verification date when present, else when posted.
  -- Never null (created_at is NOT NULL), so sourced/never-verified listings
  -- sort by recency instead of collapsing into a NULL block at the bottom.
  coalesce(p.last_verified_at, p.created_at)     as last_activity_at
from public.properties p
join public.localities l on l.id = p.locality_id
join public.profiles poster on poster.id = p.posted_by
left join public.areas ar on ar.id = p.area_id
left join lateral (
  -- Only the name. The phone and the private note are deliberately not selected.
  select ls.source_name
  from public.listing_sources ls
  where ls.property_id = p.id
  limit 1
) src on true
left join lateral (
  select count(*)::int as open_count
  from public.mismatch_reports mr
  where mr.property_id = p.id and mr.status = 'open'
) m on true
left join lateral (
  select pp.storage_path, pp.thumbnail_path, pp.captured_at
  from public.property_photos pp
  where pp.property_id = p.id
  order by (pp.room_type <> 'hall'), pp.sort_order, pp.created_at
  limit 1
) cover on true
left join lateral (
  select
    count(*)::int as photo_count,
    count(*) filter (
      where pp.room_type in ('hall', 'kitchen', 'bathroom', 'bedroom')
    )::int as rooms_covered
  from public.property_photos pp
  where pp.property_id = p.id
) ph on true
where p.status = 'live';

grant select on public.v_listings_public to anon, authenticated;
