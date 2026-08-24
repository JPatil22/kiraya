-- ============================================================================
-- Kiraya — migrations 0013 + 0014.
--
-- 0013 (money formatting in notification bodies) had not been applied yet, and
-- 0014 depends on its format_inr helper — so both are bundled here. 0013 is
-- function replacements only, so running it now is safe whether or not you
-- ran it before.
--
-- Paste the whole thing into the Supabase SQL editor and Run.
--
-- If the editor complains about the ALTER TYPE at the top of the 0014 section
-- ("unsafe use of new value of enum type"), run that ONE line on its own first,
-- then run the rest. PostgreSQL will not let a new enum value be used in the
-- same transaction that introduces it.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0013 — Format money in notification bodies
--
-- 0012's fan-out composed "rent is now 34000 (was 30000)". Every other surface
-- in the product renders that as ₹34,000, and money presentation is not a
-- detail here — the whole cost-transparency argument rests on numbers being
-- legible at a glance. A notification is often the first thing someone reads
-- about a price change, so it's the worst place to show a bare integer.
--
-- Indian digit grouping (1,50,000 — not 150,000) has no `to_char` mask, so it
-- needs the small helper below. Replaces two functions; safe to re-run.
-- ---------------------------------------------------------------------------

create or replace function public.format_inr(p_amount bigint)
returns text
language plpgsql
immutable
as $$
declare
  digits text := abs(p_amount)::text;
  head   text;
  tail   text;
  groups text := '';
begin
  -- Last three digits, then twos: 1234567 -> 12,34,567.
  if length(digits) <= 3 then
    return case when p_amount < 0 then '-₹' else '₹' end || digits;
  end if;

  tail := right(digits, 3);
  head := left(digits, length(digits) - 3);

  while length(head) > 2 loop
    groups := ',' || right(head, 2) || groups;
    head   := left(head, length(head) - 2);
  end loop;

  return case when p_amount < 0 then '-₹' else '₹' end || head || groups || ',' || tail;
end;
$$;

-- Which `property_updates.field` values are rupee amounts. Anything else (a
-- date, an availability enum) is passed through as written.
create or replace function public.format_update_value(p_field text, p_value text)
returns text
language plpgsql
immutable
as $$
begin
  if p_value is null then
    return 'unset';
  end if;

  if p_field in ('rent', 'deposit', 'maintenance_monthly', 'brokerage', 'one_time_charges')
     and p_value ~ '^-?\d+$' then
    return public.format_inr(p_value::bigint);
  end if;

  -- Enum-ish values read better with spaces: on_hold -> "on hold".
  return replace(p_value, '_', ' ');
end;
$$;

create or replace function public.notify_saved_listing_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  title text;
  saver record;
  label text;
begin
  if new.kind = 'verification' then return new; end if;

  select p.title into title from public.properties p where p.id = new.property_id;
  label := replace(new.field, '_', ' ');

  for saver in
    select s.user_id from public.shortlists s where s.property_id = new.property_id
  loop
    -- Don't tell someone about a change they made themselves.
    if saver.user_id is distinct from new.changed_by then
      perform public.notify(
        saver.user_id,
        'saved_listing_changed',
        'A listing you saved changed: ' || label || ' is now ' ||
          public.format_update_value(new.field, new.new_value) ||
          ' (was ' || public.format_update_value(new.field, new.old_value) || ')',
        new.property_id
      );
    end if;
  end loop;

  return new;
end;
$$;


-- ---------------------------------------------------------------------------
-- 0014 — Match new listings to standing tenant intents
--
-- `tenant_intents` has so far benefited brokers only. A tenant fills in budget,
-- configuration and move-in date, and gets nothing back — which is exactly why
-- the intent form reads as a hurdle rather than something worth keeping current.
--
-- Everything needed to close that was already here: the intents, the
-- notification table and triggers (0012), and the matching predicate that
-- 0004's broker view implies. This is the broker suggestion flow with no broker
-- in it: when a listing goes live, whoever is actively looking for that thing
-- hears about it.
--
-- ## Precision over recall, deliberately
--
-- A notification is a push. A near-miss is spam, and spam trains people to
-- ignore the channel that the last five features depend on. So a match must
-- clear every bar: same locality, exact configuration, all-in cost inside the
-- stated budget, available by the date they said, and open to who they are.
--
-- Furnishing is NOT part of the test. Someone asking for semi-furnished is
-- rarely offended by a fully-furnished flat at the same price, and adding it
-- would drop real matches for a preference the listing states plainly anyway.
--
-- ## NOTE ON RUNNING THIS
-- The first statement adds a value to an existing enum. PostgreSQL will not let
-- a new enum value be USED in the same transaction that adds it — creating the
-- function below is fine (a plpgsql body isn't resolved until it runs), but if
-- your SQL editor objects, run the ALTER TYPE on its own and then the rest.
-- ---------------------------------------------------------------------------

alter type public.notification_kind add value if not exists 'listing_matched';

-- ---------------------------------------------------------------------------
-- Fires when a listing becomes publicly visible — on approval, or on a
-- reinstatement. Not on every update: a rent change on an already-live listing
-- reaches savers through 0012's fan-out, and would otherwise re-notify every
-- matching tenant each time the owner touched anything.
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
      -- Available by the time they need to move, not merely available someday.
      and new.available_from <= ti.move_in_date
      -- The landlord's preference has to admit them; 'any' admits everyone.
      and (new.occupancy_pref = 'any' or new.occupancy_pref = ti.occupancy)
      -- Don't tell someone about their own listing.
      and ti.tenant_id <> new.posted_by
  loop
    -- A listing taken down and reinstated shouldn't arrive twice.
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

create trigger properties_notify_matches_aiu
  after insert or update on public.properties
  for each row execute function public.notify_intent_matches();
