-- ============================================================================
-- 0033_photo_thumbnails.sql — A small photo for the feed
--
-- The upload already shrinks a camera photo to 1600px before it leaves the
-- browser (src/lib/downscale.ts). That is the right size for the detail page,
-- where someone is deciding on this one flat — but it is roughly ten times the
-- bytes a feed card needs, and the feed is where a tenant pulls twenty of them
-- at once on mobile data. Serving the full image on a card is the single
-- largest avoidable cost this product still imposes on the person it serves.
--
-- So a second, ~400px variant is produced in the same browser pass and stored
-- alongside the full image. The card asks for the small one; the detail page
-- and gallery keep asking for the full one. Nothing is transformed at serve
-- time and no image tier is billed — it is two files where there was one.
--
-- `thumbnail_path` is nullable on purpose. A photo uploaded before this
-- migration has no thumbnail, and a browser that could not produce one (an old
-- canvas, a decode failure) uploads without it rather than blocking a listing.
-- Every reader falls back to `storage_path` when it is null, so the small image
-- is an optimisation, never a dependency — exactly the contract the client-side
-- resize already keeps.
-- ============================================================================

alter table public.property_photos
  add column if not exists thumbnail_path text;

comment on column public.property_photos.thumbnail_path is
  'Object key of a ~400px feed-sized variant of storage_path, same bucket. '
  'Null for photos uploaded before 0033 or when the browser could not produce '
  'one; readers fall back to storage_path.';

-- ---------------------------------------------------------------------------
-- Expose the cover thumbnail on the public read-model so a feed card can pick
-- the small image server-side (the card is a Server Component and has no
-- client-side onError to fall back with — the view must tell it what exists).
--
-- Dropped and recreated rather than CREATE OR REPLACE so the new column sits
-- beside cover_photo_path instead of trailing the list; nothing depends on this
-- view, so the drop is safe. Definition is 0027's, verbatim, plus two lines.
-- ---------------------------------------------------------------------------
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
