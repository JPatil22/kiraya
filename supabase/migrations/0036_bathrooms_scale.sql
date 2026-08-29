-- ============================================================================
-- 0036_bathrooms_scale.sql — Bathrooms scale with the configuration
--
-- 0008 modelled every flat as having exactly one bathroom: only bedrooms were
-- allowed a room_index > 1, and rooms_required was `hall + kitchen + 1 bathroom
-- + bedrooms`. But an Indian 2BHK almost always has two bathrooms, a 3BHK two,
-- a 4+ three — so the single-bathroom slot left a real room with nowhere to put
-- its photo, and understated what a tenant expects to see.
--
-- This lets bathrooms scale like bedrooms: a per-BHK bathroom count, the room
-- trigger accepts bathroom #2/#3, and rooms_required counts them. room_index's
-- 1..4 check already covers up to three bathrooms, so no column change.
--
-- rooms_required_for_bhk is a plain SQL function that v_listings_public calls,
-- so redefining it here updates the read-model's "X of Y rooms" without touching
-- the view.
-- ============================================================================

-- Bathrooms a configuration is expected to have. Twin of BATHROOMS_FOR_BHK in
-- src/lib/rooms.ts — keep the two in step.
create or replace function public.bathrooms_for_bhk(p_bhk public.bhk_type)
returns int
language sql
immutable
as $$
  select case p_bhk
    when '1rk'   then 1
    when '1bhk'  then 1
    when '2bhk'  then 2
    when '3bhk'  then 2
    when '4plus' then 3
  end;
$$;

-- Required slots = hall + kitchen + one per bedroom + one per bathroom.
create or replace function public.rooms_required_for_bhk(p_bhk public.bhk_type)
returns int
language sql
immutable
as $$
  select 2 + public.bedrooms_for_bhk(p_bhk) + public.bathrooms_for_bhk(p_bhk);
$$;

-- The slot-validity trigger now numbers bathrooms too: bedroom index within the
-- bedroom count, bathroom index within the bathroom count, everything else = 1.
create or replace function public.property_photos_room_valid()
returns trigger
language plpgsql
as $$
declare
  v_bhk       public.bhk_type;
  v_bedrooms  int;
  v_bathrooms int;
begin
  select bhk into v_bhk from public.properties where id = new.property_id;
  v_bedrooms  := public.bedrooms_for_bhk(v_bhk);
  v_bathrooms := public.bathrooms_for_bhk(v_bhk);

  if new.room_type = 'bedroom' then
    if v_bedrooms = 0 then
      raise exception 'A % has no separate bedroom', v_bhk using errcode = '23514';
    end if;
    if new.room_index > v_bedrooms then
      raise exception 'A % has % bedroom(s); bedroom % does not exist',
        v_bhk, v_bedrooms, new.room_index using errcode = '23514';
    end if;
  elsif new.room_type = 'bathroom' then
    if new.room_index > v_bathrooms then
      raise exception 'A % has % bathroom(s); bathroom % does not exist',
        v_bhk, v_bathrooms, new.room_index using errcode = '23514';
    end if;
  elsif new.room_index <> 1 then
    raise exception 'Only bedrooms and bathrooms are numbered' using errcode = '23514';
  end if;

  return new;
end;
$$;
