-- ---------------------------------------------------------------------------
-- 0021 — Possible duplicate listings
--
-- The same flat posted by three brokers at three prices is the defining plague
-- of Indian rental sites, and it is the purest expression of what this product
-- claims to be about: truth over volume. A tenant who calls three numbers about
-- one flat has been wasted three times, and the feed looks three times deeper
-- than it is.
--
-- ## Flag, never merge
--
-- This deliberately does not collapse anything. Two genuinely different flats
-- in the same society at the same rent are common, and auto-merging them would
-- silently delete a real landlord's listing on a heuristic. So this surfaces
-- candidate PAIRS for a human, and the existing takedown RPC does the rest.
--
-- ## The signals
--
-- Same locality, same configuration, same area, near-identical all-in cost, and
-- a similar address line. Rent alone is far too weak — half of Baner's 2BHKs
-- ask ₹30,000. Address alone is too weak the other way, since one broker writes
-- "Nyati Estate Rd" and another "Nyati Estate Road". Requiring both, plus
-- trigram similarity on the address, is what makes the pair worth a look.
-- ---------------------------------------------------------------------------

-- Trigram similarity for the fuzzy address comparison.
create extension if not exists pg_trgm;

create or replace view public.v_possible_duplicates as
select
  a.id                          as property_id,
  b.id                          as other_id,
  a.title                       as title,
  b.title                       as other_title,
  a.posted_by                   as posted_by,
  b.posted_by                   as other_posted_by,
  (a.rent + a.maintenance_monthly) as all_in_monthly,
  (b.rent + b.maintenance_monthly) as other_all_in_monthly,
  ar.name                       as area_name,
  round(
    similarity(
      coalesce(a.address_line, a.title),
      coalesce(b.address_line, b.title)
    )::numeric,
    2
  )                             as address_similarity,
  -- Different posters is the case that actually matters: one broker listing the
  -- same flat twice is untidy, three brokers listing it is the plague.
  (a.posted_by <> b.posted_by)  as different_posters
from public.properties a
join public.properties b
  on b.id > a.id                       -- each pair once, never self
 and b.locality_id = a.locality_id
 and b.bhk         = a.bhk
 and b.status      = 'live'
 and a.status      = 'live'
 -- Same area, or both unset. `is not distinct from` so two nulls match.
 and b.area_id is not distinct from a.area_id
 -- Within 5% on the honest number, not on bare rent.
 and abs((a.rent + a.maintenance_monthly) - (b.rent + b.maintenance_monthly))
       <= greatest(a.rent + a.maintenance_monthly, b.rent + b.maintenance_monthly) * 0.05
left join public.areas ar on ar.id = a.area_id
where similarity(
        coalesce(a.address_line, a.title),
        coalesce(b.address_line, b.title)
      ) > 0.3
  -- Admin-only, enforced HERE rather than by a grant: a view runs with its
  -- owner's rights and bypasses RLS on the tables underneath, so a grant alone
  -- would hand every signed-in user a map of which listings resemble which.
  -- Null auth.uid() is the trusted context (service-role / open mode).
  and (auth.uid() is null or public.is_admin());

revoke all on public.v_possible_duplicates from anon;
grant select on public.v_possible_duplicates to authenticated;
