-- ---------------------------------------------------------------------------
-- 0028 — Areas know where they are
--
-- This started as a fix for something that turned out not to be broken, and the
-- correction is worth recording because it is the more useful finding.
--
-- Measuring the geocoders after 0027 gave Google 10/10 on real Pune societies
-- against OpenStreetMap's 3/10, but two of Google's answers looked wrong:
-- "Nyati Estate Kharadi" returned a Nyati Estate in Mohammed Wadi, and "Marvel
-- Diva Wanowrie" landed in Magarpatta. The obvious diagnosis was a ranking
-- problem — bias the search to the chosen area and the right one wins.
--
-- It isn't. Asking Google for every "Nyati Estate" prediction in Pune returns
-- five, and all five are in Mohammed Wadi or Undri. There is no Nyati Estate in
-- Kharadi. The address came from our own seed script, which invented it. The
-- geocoder was right and the query was wrong, which is a good reminder that
-- demo data is not evidence.
--
-- What survives is the plainly useful half: the form asks which area the flat
-- is in one field above the map, and the map opened over the middle of Pune
-- regardless. Now it opens on the area, and search is biased there too — which
-- costs nothing and helps whenever a name genuinely is ambiguous, even if the
-- case that prompted it wasn't.
--
-- Twelve centres, hand-placed on the recognised centre of each area rather than
-- computed from a boundary — nobody agrees where Baner stops, and the number
-- only needs to be close enough to rank one Nyati Estate above another.
--
-- Nullable because an area added later shouldn't be blocked on someone knowing
-- its coordinates, and the UI falls back to the city centre exactly as before.
-- ---------------------------------------------------------------------------

alter table public.areas
  add column if not exists latitude  numeric(9, 6),
  add column if not exists longitude numeric(9, 6);

alter table public.areas
  drop constraint if exists areas_centre_pair;

alter table public.areas
  add constraint areas_centre_pair
  check (
    (latitude is null and longitude is null)
    or (
      latitude  is not null and longitude is not null
      and latitude  between -90  and 90
      and longitude between -180 and 180
    )
  );

comment on column public.areas.latitude is
  'Rough centre of the area, used to bias place search and open the map somewhere useful. Not a boundary.';

update public.areas as a
set latitude = c.lat, longitude = c.lng
from (values
  ('aundh',            18.559000, 73.807800),
  ('balewadi',         18.575000, 73.769000),
  ('baner',            18.559000, 73.777000),
  ('hadapsar',         18.508900, 73.926000),
  ('hinjewadi',        18.591000, 73.738000),
  ('kharadi',          18.551500, 73.943600),
  ('koregaon-park',    18.536200, 73.893900),
  ('kothrud',          18.507400, 73.807700),
  ('magarpatta',       18.515700, 73.928000),
  ('pimple-saudagar',  18.598000, 73.790000),
  ('viman-nagar',      18.567900, 73.914300),
  ('wakad',            18.598700, 73.761400)
) as c(slug, lat, lng)
where a.slug = c.slug;
