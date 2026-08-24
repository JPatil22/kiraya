-- ---------------------------------------------------------------------------
-- 0019 — Areas within the locality
--
-- The PRD's bet is "win one neighbourhood". The launch market is modelled as a
-- single `locality` row covering all of Pune — roughly 500 km² and seven
-- million people — so a tenant in Kothrud scrolls listings in Kharadi twenty
-- kilometres away with no way to narrow, and one `verify_stale_days` governs
-- the entire city. docs/ROADMAP.md calls this the largest known deviation from
-- the PRD, and every feature built since has made it more visible: search
-- partly papers over it, which is arguably worse, because it looks solved.
--
-- ## Why a table rather than a text column
--
-- Free text would give "Baner", "baner", "Baner Road" and "Balewadi/Baner" as
-- four different places within a week, and a filter over that is a lie. A
-- controlled list keeps the feed filter, the tenant's intent and the matching
-- trigger all speaking about the same thing.
--
-- ## One area, not many, for now
--
-- A real search is often "Baner or Balewadi", and that wants an array or a join
-- table. This ships the single-area version deliberately: it makes the filter,
-- the form and the 0014 matcher simple and correct, and multi-select is an
-- additive change later. Null means "anywhere", so nothing is forced.
-- ---------------------------------------------------------------------------

create table public.areas (
  id          uuid primary key default gen_random_uuid(),
  locality_id uuid not null references public.localities (id) on delete cascade,
  slug        text not null,
  name        text not null,
  created_at  timestamptz not null default now(),
  unique (locality_id, slug)
);

create index areas_locality_idx on public.areas (locality_id, name);

alter table public.areas enable row level security;

-- Same shape as `localities`: everyone reads, admins curate.
create policy areas_read_all on public.areas for select using (true);
create policy areas_admin_write on public.areas
  for all using (public.is_admin()) with check (public.is_admin());

grant select on public.areas to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Seed the Pune neighbourhoods a tenant would actually name.
-- ---------------------------------------------------------------------------
insert into public.areas (locality_id, slug, name)
select l.id, a.slug, a.name
from public.localities l
cross join (values
  ('aundh',            'Aundh'),
  ('balewadi',         'Balewadi'),
  ('baner',            'Baner'),
  ('hadapsar',         'Hadapsar'),
  ('hinjewadi',        'Hinjewadi'),
  ('kharadi',          'Kharadi'),
  ('koregaon-park',    'Koregaon Park'),
  ('kothrud',          'Kothrud'),
  ('magarpatta',       'Magarpatta'),
  ('pimple-saudagar',  'Pimple Saudagar'),
  ('viman-nagar',      'Viman Nagar'),
  ('wakad',            'Wakad')
) as a(slug, name)
where l.slug = 'pune'
on conflict (locality_id, slug) do nothing;

-- ---------------------------------------------------------------------------
-- Hang listings and intents off it. Nullable: existing rows predate this, and
-- "anywhere" is a legitimate answer for a tenant.
-- ---------------------------------------------------------------------------
alter table public.properties      add column if not exists area_id uuid references public.areas (id);
alter table public.tenant_intents  add column if not exists area_id uuid references public.areas (id);

create index if not exists properties_area_idx on public.properties (area_id, status);

-- Backfill from what the addresses already say. Matching on the address line
-- first and the title second, because "Balewadi, Baner" should land on the
-- street it names rather than the headline it was written with.
update public.properties p
set area_id = a.id
from public.areas a
where p.area_id is null
  and a.locality_id = p.locality_id
  and coalesce(p.address_line, '') ilike '%' || a.name || '%';

update public.properties p
set area_id = a.id
from public.areas a
where p.area_id is null
  and a.locality_id = p.locality_id
  and p.title ilike '%' || a.name || '%';

-- ---------------------------------------------------------------------------
-- Expose it on the read model. Dropped and recreated because CREATE OR REPLACE
-- can only append columns and this belongs beside the other location fields.
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

-- ---------------------------------------------------------------------------
-- Price context becomes area-aware: comparing a Kothrud flat against Koregaon
-- Park was the thing that made a city-wide median close to meaningless. Falls
-- back to the whole locality when either side has no area yet, so the feature
-- degrades rather than disappearing during backfill.
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
    and o.availability <> 'rented'
    and o.locality_id = p.locality_id
    and o.bhk = p.bhk
    and o.id <> p.id
    and (p.area_id is null or o.area_id is null or o.area_id = p.area_id)
) ctx
where p.status = 'live';

grant select on public.v_listing_price_context to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Matching (0014) respects area: a tenant who named one should not be told
-- about a flat twenty kilometres away, which is precisely the spam that would
-- teach people to ignore the notification channel.
-- ---------------------------------------------------------------------------
create or replace function public.notify_intent_matches()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  all_in   int;
  matched  record;
begin
  if new.status <> 'live' then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'live' then return new; end if;

  all_in := new.rent + new.maintenance_monthly;

  for matched in
    select ti.tenant_id
    from public.tenant_intents ti
    where ti.status = 'active'
      and ti.locality_id = new.locality_id
      and ti.bhk         = new.bhk
      and all_in between ti.budget_min and ti.budget_max
      and new.available_from <= ti.move_in_date
      and (new.occupancy_pref = 'any' or new.occupancy_pref = ti.occupancy)
      -- Null intent area means "anywhere", so it still matches.
      and (ti.area_id is null or ti.area_id = new.area_id)
      and ti.tenant_id <> new.posted_by
  loop
    if not exists (
      select 1 from public.notifications n
      where n.user_id = matched.tenant_id
        and n.property_id = new.id
        and n.kind = 'listing_matched'
    ) then
      perform public.notify(
        matched.tenant_id,
        'listing_matched',
        'New match: "' || new.title || '" at ' || public.format_inr(all_in) || '/mo all-in',
        new.id
      );
    end if;
  end loop;

  return new;
end;
$$;
