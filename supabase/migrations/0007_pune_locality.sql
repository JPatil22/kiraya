-- ============================================================================
-- 0007_pune_locality.sql — Relaunch on Pune
--
-- The launch market moves from HSR Layout (Bengaluru) to Pune. Note that Pune
-- is a CITY being used as a single `locality` row, which is a deliberate
-- departure from the PRD's "win one neighbourhood completely" bet: one
-- staleness window and one undifferentiated feed now span ~500 km². The feed
-- has no geography filter, so a tenant in Kothrud sees Kharadi listings with no
-- way to narrow down. Tracked in docs/ROADMAP.md — add a sub-locality/area
-- dimension before this becomes the thing tenants complain about.
--
-- HSR Layout is deactivated rather than deleted: `properties.locality_id` and
-- `tenant_intents.locality_id` reference it, and history is not ours to erase.
-- ============================================================================

insert into public.localities (slug, name, city, state, verify_stale_days)
values ('pune', 'Pune', 'Pune', 'Maharashtra', 7)
on conflict (slug) do nothing;

update public.localities
   set is_active = false
 where slug = 'hsr-layout';
