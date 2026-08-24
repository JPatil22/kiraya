-- ---------------------------------------------------------------------------
-- 0018 — Fix v_listing_engagement under service-role
--
-- 0017 scoped the view with `posted_by = auth.uid() or is_admin()`. Correct for
-- a real session, and empty for everything else — including open mode, which
-- runs as service-role where `auth.uid()` is null. So the counts an owner was
-- meant to see returned nothing at all, silently.
--
-- The fix is the passthrough `properties_guard` already documents: a null
-- `auth.uid()` means a trusted context (service-role, migrations, the SQL
-- editor), which bypasses RLS anyway. This widens nothing real — the view is
-- granted to `authenticated` only, so anon still cannot reach it.
-- ---------------------------------------------------------------------------

create or replace view public.v_listing_engagement as
select
  p.id                                   as property_id,
  p.posted_by,
  coalesce(s.saves, 0)                   as saves,
  coalesce(c.enquiries, 0)               as enquiries,
  coalesce(f.answered, 0)                as visits_answered
from public.properties p
left join lateral (
  select count(*)::int as saves
  from public.shortlists sl where sl.property_id = p.id
) s on true
left join lateral (
  select count(*)::int as enquiries
  from public.contact_exchanges ce where ce.property_id = p.id
) c on true
left join lateral (
  select count(*)::int as answered
  from public.visit_feedback vf
  where vf.property_id = p.id and vf.outcome <> 'did_not_visit'
) f on true
where auth.uid() is null            -- trusted context: service-role / direct DB
   or p.posted_by = auth.uid()
   or public.is_admin();

grant select on public.v_listing_engagement to authenticated;
