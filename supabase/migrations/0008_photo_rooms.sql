-- ============================================================================
-- 0008_photo_rooms.sql — Structured photos: one slot per room
--
-- Photos stop being an unlabelled pile. Every photo claims a room, and the set
-- of rooms a listing OWES is derived from its BHK: a 2BHK owes hall, kitchen,
-- bathroom and two bedrooms. One photo per slot, so a listing can't pad itself
-- with eight angles of the same living room and look complete.
--
-- Coverage then becomes a trust signal in its own right, alongside freshness:
-- "4 of 5 rooms shown" tells a tenant what is being left out.
-- ============================================================================

create type public.room_type as enum (
  'hall',       -- living room; for a 1RK this is the room itself
  'kitchen',
  'bedroom',
  'bathroom',
  'balcony',    -- optional extra
  'exterior'    -- optional extra: building, entrance, parking
);

-- ---------------------------------------------------------------------------
-- How many bedrooms a configuration owes. 1RK has none — its `hall` slot is
-- the single room, which is exactly what makes a 1RK a 1RK.
-- ---------------------------------------------------------------------------
create or replace function public.bedrooms_for_bhk(p_bhk public.bhk_type)
returns int
language sql
immutable
as $$
  select case p_bhk
    when '1rk'   then 0
    when '1bhk'  then 1
    when '2bhk'  then 2
    when '3bhk'  then 3
    when '4plus' then 4
  end;
$$;

/** Required slots = hall + kitchen + bathroom + one per bedroom. */
create or replace function public.rooms_required_for_bhk(p_bhk public.bhk_type)
returns int
language sql
immutable
as $$
  select 3 + public.bedrooms_for_bhk(p_bhk);
$$;

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
alter table public.property_photos
  add column room_type  public.room_type,
  -- Distinguishes "Bedroom 1" from "Bedroom 2". Always 1 for single rooms.
  add column room_index smallint not null default 1 check (room_index between 1 and 4);

-- Existing photos predate slots; park them on the hall so the column can be
-- NOT NULL. There are only demo rows at this point.
update public.property_photos set room_type = 'hall' where room_type is null;

-- Keep the first hall photo per property, retag the rest as exterior so the
-- unique index below can be created without collisions.
with ranked as (
  select id, row_number() over (partition by property_id, room_type, room_index
                                order by sort_order, created_at) as rn
  from public.property_photos
)
update public.property_photos p
   set room_type = 'exterior'
  from ranked r
 where r.id = p.id and r.rn > 1;

alter table public.property_photos alter column room_type set not null;

-- One photo per room slot. This is the rule that stops "random photos".
create unique index property_photos_one_per_room
  on public.property_photos (property_id, room_type, room_index);

-- ---------------------------------------------------------------------------
-- A slot has to make sense for the configuration: no "Bedroom 3" on a 1BHK,
-- and no bedroom at all on a 1RK.
-- ---------------------------------------------------------------------------
create or replace function public.property_photos_room_valid()
returns trigger
language plpgsql
as $$
declare
  v_bhk      public.bhk_type;
  v_bedrooms int;
begin
  select bhk into v_bhk from public.properties where id = new.property_id;
  v_bedrooms := public.bedrooms_for_bhk(v_bhk);

  if new.room_type = 'bedroom' then
    if v_bedrooms = 0 then
      raise exception 'A % has no separate bedroom', v_bhk using errcode = '23514';
    end if;
    if new.room_index > v_bedrooms then
      raise exception 'A % has % bedroom(s); bedroom % does not exist',
        v_bhk, v_bedrooms, new.room_index using errcode = '23514';
    end if;
  elsif new.room_index <> 1 then
    raise exception 'Only bedrooms are numbered' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger property_photos_room_valid_biu
  before insert or update on public.property_photos
  for each row execute function public.property_photos_room_valid();

-- ---------------------------------------------------------------------------
-- Surface coverage on the public read-model. Dropped and recreated because
-- CREATE OR REPLACE can only append columns (see 0003).
-- ---------------------------------------------------------------------------
drop view if exists public.v_listings_public;

create view public.v_listings_public as
select
  p.id,
  p.locality_id,
  l.slug              as locality_slug,
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
left join lateral (
  select count(*)::int as open_count
  from public.mismatch_reports mr
  where mr.property_id = p.id and mr.status = 'open'
) m on true
left join lateral (
  -- The hall leads by default: it's the room a tenant judges first.
  select pp.storage_path, pp.captured_at
  from public.property_photos pp
  where pp.property_id = p.id
  order by (pp.room_type <> 'hall'), pp.sort_order, pp.created_at
  limit 1
) cover on true
left join lateral (
  select
    count(*)::int as photo_count,
    -- Only required slots count toward coverage; balconies don't fill a bedroom.
    count(*) filter (
      where pp.room_type in ('hall', 'kitchen', 'bathroom', 'bedroom')
    )::int as rooms_covered
  from public.property_photos pp
  where pp.property_id = p.id
) ph on true
where p.status = 'live';

grant select on public.v_listings_public to anon, authenticated;
