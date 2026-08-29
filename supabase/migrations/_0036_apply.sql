-- ============================================================================
-- _0036_apply.sql — paste this into the Supabase SQL editor.
--
-- Idempotent: three `create or replace` — bathrooms_for_bhk (new), a redefined
-- rooms_required_for_bhk (hall + kitchen + bedrooms + bathrooms), and a redefined
-- room-validity trigger that now numbers bathrooms. Safe to run more than once.
--
-- Effect: a 2BHK now expects 2 bathrooms, a 3BHK 2, a 4+ 3 — matching the app's
-- room-slot model (src/lib/rooms.ts). v_listings_public calls
-- rooms_required_for_bhk, so its "X of Y rooms" updates with no view change.
-- See 0036_bathrooms_scale.sql for the reasoning.
-- ============================================================================

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

create or replace function public.rooms_required_for_bhk(p_bhk public.bhk_type)
returns int
language sql
immutable
as $$
  select 2 + public.bedrooms_for_bhk(p_bhk) + public.bathrooms_for_bhk(p_bhk);
$$;

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
