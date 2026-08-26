-- ============================================================================
-- Kiraya - migration 0027.
--
--   0027  WHERE THE FLAT ACTUALLY IS: latitude/longitude on properties, exposed
--         to tenants through v_listings_public. This deliberately reverses
--         0002's "exact address off-platform" stance - see the reasoning below.
--         Both-or-neither is a constraint; not pinned stays legitimate.
--
-- Your database already has 0001-0026. Paste into the Supabase SQL editor and
-- Run. It drops and recreates v_listings_public, which is expected, and is safe
-- to run more than once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0027 — Where the flat actually is
--
-- 0002 wrote `address_line text, -- coarse; exact address off-platform for MVP`
-- and meant it: a listing gave a road and an area, and the tenant worked the
-- rest out on the phone. 0019 added areas, which narrowed "Pune" to "Kharadi"
-- and stopped there.
--
-- This reverses that stance deliberately. The cost it was protecting against
-- was address harvesting; the cost it was imposing is a tenant crossing the
-- city to discover the flat is on the wrong side of a highway, and doing it
-- again the next weekend. That trade was wrong. Travelling to find out where
-- something is, is the single most expensive thing this product still asks of
-- the person it claims to serve — and every wasted trip is also a wasted
-- viewing for the owner.
--
-- Note what does NOT change: the phone number stays behind the contact
-- exchange (0010), with its daily limit. Knowing where a building is and being
-- able to ring the person who owns it are different things, and only the second
-- one is what the harvesting rule was ever really about.
--
-- ## Both or neither
--
-- A latitude with no longitude is not a half-known location, it is a broken
-- row, so the constraint refuses it. Null for both stays legitimate — a poster
-- who genuinely does not know, and every listing that predates this migration.
-- The UI says "location not pinned" rather than dropping a marker in the middle
-- of the city and hoping, which is the same rule the freshness stamp follows.
--
-- ## numeric(9,6)
--
-- Six decimal places is about 11 cm at this latitude — far beyond what anyone
-- can place by dragging a pin, and small enough that a society entrance is
-- distinguishable from the back gate. Stored as numeric rather than float
-- because these are coordinates people typed, not measurements to compute with;
-- exactness of round-trip matters more than arithmetic speed. PostGIS would buy
-- distance sorting and nothing else today, and it is a heavy dependency to add
-- for a column pair.
-- ---------------------------------------------------------------------------

alter table public.properties
  add column if not exists latitude  numeric(9, 6),
  add column if not exists longitude numeric(9, 6);

alter table public.properties
  drop constraint if exists properties_location_pair;

alter table public.properties
  add constraint properties_location_pair
  check (
    (latitude is null and longitude is null)
    or (
      latitude  is not null and longitude is not null
      and latitude  between -90  and 90
      and longitude between -180 and 180
    )
  );

comment on column public.properties.latitude is
  'Exact pinned location, set by whoever posted it. Null means not pinned — the UI says so rather than guessing.';

-- ---------------------------------------------------------------------------
-- Onto the read model, beside the other location fields.
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
  select pp.storage_path, pp.captured_at
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
