-- ============================================================================
-- 0035_public_source_name.sql — Credit a seeded listing's broker on the public page
--
-- 0034 kept listing_sources wholly private, on the principle that the public
-- page carries the concierge's contact, not a third party's. This deployment
-- makes a different, deliberate product choice for bootstrapping supply: a
-- listing seeded from an outside post CREDITS the real broker by name on the
-- public page — shown as aggregated-by-Kiraya and not-yet-verified, so it reads
-- as a citation rather than a claim the broker signed up — and reveals their
-- number only on contact unlock.
--
-- This exposes ONLY source_name. source_phone and the private note stay out of
-- every public read; the number reaches a tenant solely through the
-- contact-exchange path, gated on an unlock (see getListingContact).
--
-- The view runs with its owner's rights (not security_invoker), which is how a
-- column from an RLS-locked table can appear in an anon-readable view at all —
-- exactly the mechanism 0034's comment names. Nothing else about the view
-- changes: definition is 0033's, verbatim, plus one lateral join and one column.
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
  p.created_at
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
