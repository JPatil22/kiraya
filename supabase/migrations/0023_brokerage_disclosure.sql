-- ---------------------------------------------------------------------------
-- 0023 — Brokerage is a claim, not a default
--
-- `brokerage` has been a cost component since 0002, and it has always been
-- `not null default 0`. That default is the hole. A broker who leaves the field
-- alone produces a listing that renders exactly like an owner's — a move-in
-- cost with no fee in it — and then asks for a month's rent at the door. The
-- number the tenant budgeted against was never a statement by anyone; it was an
-- unset column. This is the same failure the product already refuses to accept
-- for freshness: `last_verified_at` stays null rather than defaulting to today,
-- and the UI says "not verified yet" rather than implying otherwise. Cost
-- deserves the same treatment.
--
-- Rather than make `brokerage` nullable — which would push null through
-- `move_in_cost` and every view computing it since 0002 — the claim is a
-- separate column. `brokerage_disclosed` means "a human stated this amount",
-- and zero is a perfectly good thing to state.
--
-- ## The two rules, and why they live in a trigger
--
--   1. A BROKER must disclose. Zero is allowed; silence is not.
--   2. An OWNER cannot charge brokerage at all. If a fee is being collected,
--      somebody is brokering, and the tenant is entitled to know which of the
--      two they are talking to.
--
-- Both rules read `profiles.role`, which a CHECK constraint cannot reach, so
-- they are a trigger. This one deliberately does NOT copy the `auth.uid() is
-- null` passthrough that `properties_guard` uses. That guard constrains
-- *privilege* — who may publish, who may stamp a verification — and trusted
-- contexts legitimately hold every privilege. This is an *integrity* rule about
-- what a row may claim, and it is no more true from the service-role key than
-- from a session. Open mode runs as service-role, so a passthrough here would
-- mean the rule never fired once in the app as it actually runs today.
--
-- ## When it fires on UPDATE
--
-- On insert, always. On update, only when the money or the claim moves, or when
-- the listing is going live — so an admin re-verifying a legacy row is never
-- blocked by a fee it wasn't asked about, while nothing reaches a tenant
-- undisclosed.
-- ---------------------------------------------------------------------------

alter table public.properties
  add column brokerage_disclosed boolean not null default false;

comment on column public.properties.brokerage_disclosed is
  'True when the poster explicitly stated the brokerage, including stating that it is zero. False means the 0 is an unset default and must never be rendered as "no brokerage".';

-- ---------------------------------------------------------------------------
-- Backfill. An existing row counts as disclosed if it was never subject to the
-- rule (owner and admin posters) or if a broker typed a number into it. A
-- broker row still sitting at 0 is exactly the case this migration exists to
-- name, so it stays false and reads as "not stated" until the broker says so.
-- ---------------------------------------------------------------------------
update public.properties p
set brokerage_disclosed = true
from public.profiles poster
where poster.id = p.posted_by
  and (poster.role is distinct from 'broker' or p.brokerage > 0);

-- ---------------------------------------------------------------------------
-- The guard
-- ---------------------------------------------------------------------------
create or replace function public.properties_brokerage_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  poster_role public.user_role;
  money_moved boolean;
  going_live  boolean;
begin
  select role into poster_role from public.profiles where id = new.posted_by;

  -- Admin-posted rows are the ops and seed path, and an unknown poster cannot
  -- be judged. Neither is what this rule is about.
  if poster_role is null or poster_role = 'admin' then
    return new;
  end if;

  money_moved := tg_op = 'INSERT'
    or new.brokerage is distinct from old.brokerage
    or new.brokerage_disclosed is distinct from old.brokerage_disclosed;

  going_live := new.status = 'live'
    and (tg_op = 'INSERT' or old.status is distinct from 'live');

  if poster_role = 'owner' then
    if new.brokerage > 0 and money_moved then
      raise exception
        'An owner listing cannot carry a brokerage fee. If a broker is collecting one, the broker should be the one posting.'
        using errcode = '23514';
    end if;

    -- Nobody is brokering, so "no brokerage" is a fact about the row rather
    -- than a claim somebody has to remember to make.
    if new.brokerage = 0 then
      new.brokerage_disclosed := true;
    end if;

    return new;
  end if;

  -- poster_role = 'broker'
  if (money_moved or going_live) and not new.brokerage_disclosed then
    raise exception
      'State the brokerage on this listing. Zero is a fine answer; leaving it unsaid is not, because the tenant reads it as zero anyway.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger properties_brokerage_guard_biu
  before insert or update on public.properties
  for each row execute function public.properties_brokerage_guard();

-- ---------------------------------------------------------------------------
-- Expose the claim on the read model. Dropped and recreated rather than
-- CREATE OR REPLACE'd so the column can sit beside `brokerage` instead of
-- being appended at the end.
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
