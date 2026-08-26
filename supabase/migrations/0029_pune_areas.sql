-- ---------------------------------------------------------------------------
-- 0029 — The rest of Pune
--
-- 0019 seeded twelve areas and they were all IT corridor and premium pockets:
-- Hinjewadi, Kharadi, Koregaon Park, Baner. Fine for a demo, wrong for a city.
-- A flat in Karve Nagar, Narhe, Ambegaon, Swargate, Wagholi, Kondhwa or Warje
-- had no area to claim, so its poster picked "Not sure / not listed" and the
-- listing fell out of the one filter tenants actually use to narrow the feed.
-- The product was quietly best at the parts of Pune that need it least.
--
-- Thirty-eight more, taking the list to fifty: the old city and its peths, the
-- southern and south-western belt, the eastern corridor out to Wagholi, the
-- NIBM and Kondhwa side, and the PCMC towns. PCMC is not a new decision — 0019
-- already had Pimple Saudagar, and Hinjewadi's rental catchment spills into
-- Wakad, Ravet and Punawale whatever the municipal boundary says.
--
-- ## Zones
--
-- Fifty options in a flat dropdown is a wall of text. A zone per area lets the
-- select group them the way somebody actually thinks about the city — "south
-- west, near Karve Nagar" — instead of making them scan alphabetically from
-- Akurdi to Yerwada. It is a display grouping, deliberately not a hierarchy:
-- no filtering by zone, no zone table, nothing else hangs off it.
--
-- Centres stay hand-placed and approximate, as in 0028. They open a map and
-- bias a search; they are not boundaries and nobody should treat them as such.
-- ---------------------------------------------------------------------------

alter table public.areas
  add column if not exists zone text;

comment on column public.areas.zone is
  'Display grouping for the area dropdown. Not a hierarchy — nothing filters by it.';

-- ---------------------------------------------------------------------------
-- Zones for the twelve that already existed.
-- ---------------------------------------------------------------------------
update public.areas as a
set zone = z.zone
from (values
  ('aundh', 'West'), ('balewadi', 'West'), ('baner', 'West'),
  ('hadapsar', 'South East'), ('hinjewadi', 'West'), ('kharadi', 'East'),
  ('koregaon-park', 'Central'), ('kothrud', 'South West'),
  ('magarpatta', 'South East'), ('pimple-saudagar', 'PCMC'),
  ('viman-nagar', 'East'), ('wakad', 'West')
) as z(slug, zone)
where a.slug = z.slug and a.zone is null;

-- ---------------------------------------------------------------------------
-- The rest.
-- ---------------------------------------------------------------------------
insert into public.areas (locality_id, slug, name, zone, latitude, longitude)
select l.id, v.slug, v.name, v.zone, v.lat, v.lng
from public.localities l
cross join (values
  -- Central and the old city
  ('shivajinagar',    'Shivajinagar',       'Central',    18.530800, 73.847800),
  ('deccan',          'Deccan',             'Central',    18.515000, 73.840000),
  ('camp',            'Camp',               'Central',    18.515000, 73.879000),
  ('swargate',        'Swargate',           'Central',    18.501000, 73.858000),
  ('sadashiv-peth',   'Sadashiv Peth',      'Central',    18.509000, 73.848000),
  ('erandwane',       'Erandwane',          'Central',    18.507000, 73.829000),
  ('model-colony',    'Model Colony',       'Central',    18.529000, 73.836000),
  ('khadki',          'Khadki',             'Central',    18.562000, 73.846000),

  -- East
  ('yerwada',         'Yerwada',            'East',       18.551000, 73.883000),
  ('kalyani-nagar',   'Kalyani Nagar',      'East',       18.548000, 73.901000),
  ('mundhwa',         'Mundhwa',            'East',       18.540000, 73.926000),
  ('keshav-nagar',    'Keshav Nagar',       'East',       18.529000, 73.933000),
  ('chandan-nagar',   'Chandan Nagar',      'East',       18.551000, 73.920000),
  ('wagholi',         'Wagholi',            'East',       18.580000, 73.980000),
  ('dhanori',         'Dhanori',            'East',       18.590000, 73.890000),
  ('lohegaon',        'Lohegaon',           'East',       18.590000, 73.916000),
  ('vishrantwadi',    'Vishrantwadi',       'East',       18.570000, 73.883000),

  -- South East
  ('undri',           'Undri',              'South East', 18.465000, 73.908000),
  ('nibm-road',       'NIBM Road',          'South East', 18.474000, 73.899000),
  ('mohammed-wadi',   'Mohammed Wadi',      'South East', 18.472000, 73.920000),
  ('kondhwa',         'Kondhwa',            'South East', 18.478000, 73.889000),
  ('wanowrie',        'Wanowrie',           'South East', 18.490000, 73.899000),
  ('fursungi',        'Fursungi',           'South East', 18.479000, 73.956000),
  ('manjri',          'Manjri',             'South East', 18.510000, 73.970000),

  -- South and South West
  ('bibwewadi',       'Bibwewadi',          'South',      18.477000, 73.863000),
  ('katraj',          'Katraj',             'South',      18.453000, 73.858000),
  ('ambegaon',        'Ambegaon',           'South',      18.464000, 73.838000),
  ('dhayari',         'Dhayari',            'South West', 18.456000, 73.810000),
  ('narhe',           'Narhe',              'South West', 18.456000, 73.830000),
  ('sinhagad-road',   'Sinhagad Road',      'South West', 18.470000, 73.825000),
  ('karve-nagar',     'Karve Nagar',        'South West', 18.489000, 73.818000),
  ('warje',           'Warje',              'South West', 18.483000, 73.802000),

  -- West
  ('bavdhan',         'Bavdhan',            'West',       18.515000, 73.777000),
  ('pashan',          'Pashan',             'West',       18.538000, 73.790000),
  ('sus',             'Sus',                'West',       18.548000, 73.755000),
  ('tathawade',       'Tathawade',          'West',       18.622000, 73.744000),
  ('punawale',        'Punawale',           'West',       18.628000, 73.735000),

  -- PCMC
  ('pimpri',          'Pimpri',             'PCMC',       18.628000, 73.800000),
  ('chinchwad',       'Chinchwad',          'PCMC',       18.642000, 73.760000),
  ('nigdi',           'Nigdi',              'PCMC',       18.651000, 73.769000),
  ('akurdi',          'Akurdi',             'PCMC',       18.647000, 73.766000),
  ('ravet',           'Ravet',              'PCMC',       18.648000, 73.744000),
  ('thergaon',        'Thergaon',           'PCMC',       18.600000, 73.762000),
  ('rahatani',        'Rahatani',           'PCMC',       18.603000, 73.777000),
  ('sangvi',          'Sangvi',             'PCMC',       18.572000, 73.821000),
  ('moshi',           'Moshi',              'PCMC',       18.672000, 73.850000),
  ('chikhali',        'Chikhali',           'PCMC',       18.665000, 73.802000)
) as v(slug, name, zone, lat, lng)
where l.slug = 'pune'
on conflict (locality_id, slug) do nothing;

-- A zone holding one area looks like a mistake beside groups of nine, and Aundh
-- sits comfortably with Baner and Balewadi. Unconditional so re-running fixes
-- a database that took the first version of this file.
update public.areas set zone = 'West' where slug = 'aundh';

-- ---------------------------------------------------------------------------
-- Anything added later without a zone still needs somewhere to sit in the list.
-- ---------------------------------------------------------------------------
update public.areas set zone = 'Other' where zone is null;
