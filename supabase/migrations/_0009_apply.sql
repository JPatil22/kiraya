-- ============================================================================
-- Kiraya — migration 0009 ONLY (owner self-confirmation + availability).
-- Your database already has 0001–0008. Paste this into the Supabase SQL editor
-- (Project -> SQL Editor -> New query -> Run). Safe to run once, and safe to
-- re-run: it only replaces a function and a view.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0009 — Owner maintenance: self-confirmation and availability
--
-- Until now every post-creation change to a listing was admin-only: 0002's
-- properties_guard reserved the verification stamp for admins, and nothing in
-- the app let a poster touch availability. That made the product's core promise
-- — "last verified N days ago" — depend on an admin clicking each listing, one
-- at a time, forever. Freshness could only ever decay.
--
-- This migration hands the two maintenance actions to the person who actually
-- knows the answer, without giving up the invariants:
--
--   • A poster may re-stamp verification, but ONLY in their own name and ONLY
--     as of now. No backdating, no future-dating, no forging someone else's
--     stamp. Admins keep the unrestricted power they had.
--   • The read-model now says WHO last stamped it (`verified_by_poster`), so
--     the UI can label an owner's confirmation differently from a Kiraya
--     verification. The signal stays honest by being attributed, not by being
--     withheld — same principle as photo `captured_at`.
--
-- Availability needs no change here: RLS (`properties_update_own`) already let
-- a poster update their own row, and the guard never constrained availability.
-- It simply had no action or UI. 0003's history trigger already records both
-- `availability` and `last_verified_at` changes, so every use of this shows up
-- on the public timeline automatically.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Guard: same invariants, one new permitted move.
-- ---------------------------------------------------------------------------
create or replace function public.properties_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Trusted contexts pass straight through:
  --   • auth.uid() is null  → direct DB access (migrations, seed, SQL editor) or
  --     the service_role key. End-user anon requests can't reach here at all:
  --     the RLS insert/update policies require posted_by = auth.uid(), which is
  --     null for anon, so RLS rejects them before this trigger runs.
  --   • admins → the moderation role by definition.
  -- What's left is exactly what we mean to constrain: authenticated non-admins.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  -- Only admins can move a listing into a moderation-controlled state.
  if new.status in ('live', 'rejected')
     and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    raise exception 'Only an admin can set listing status to %', new.status
      using errcode = '42501';
  end if;

  -- Verification. A brand-new listing is never born verified.
  if tg_op = 'INSERT' then
    if new.last_verified_at is not null or new.last_verified_by is not null then
      raise exception 'Only an admin can set verification fields' using errcode = '42501';
    end if;

  elsif new.last_verified_at is distinct from old.last_verified_at
     or new.last_verified_by is distinct from old.last_verified_by then

    -- NEW in 0009: the poster may confirm their own listing. The stamp must be
    -- in their own name and dated now — that is what stops "verified" from
    -- becoming a field anyone can write anything into. Everything else stays
    -- admin-only, including clearing the stamp (last_verified_at = null).
    if not (
      new.posted_by       = auth.uid()
      and new.last_verified_by = auth.uid()
      and new.last_verified_at is not null
      -- Wide enough to absorb app/DB clock skew, far too narrow to be useful
      -- for backdating: a five-minute-old "confirmation" is still a fresh one.
      and new.last_verified_at between now() - interval '5 minutes'
                                   and now() + interval '5 minutes'
    ) then
      raise exception 'Only an admin can change verification fields' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Read-model: attribute the freshness stamp.
--
-- `verified_by_poster` is a boolean, not the verifier's id — a tenant needs to
-- know whether the owner said it or Kiraya checked it, not who the admin was.
-- Dropped and recreated because CREATE OR REPLACE can only append columns.
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
  -- Who last stamped it. Null verification reads as false: an unverified
  -- listing is not "confirmed by the owner", it is simply unconfirmed.
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
