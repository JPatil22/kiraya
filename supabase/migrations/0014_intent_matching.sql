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
