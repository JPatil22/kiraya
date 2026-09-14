-- ============================================================================
-- (paste this whole file into the Supabase SQL editor and run once — idempotent via CREATE OR REPLACE)
-- 0038 — reveal a sourced listing's real contact to an entitled viewer, under RLS.
--
-- listing_sources (0034) is poster/admin-only. That is right for the private
-- note, but it also hid the real broker name + number from a TENANT who has
-- unlocked contact (holds a contact_exchange) — so in the auth-gated app the
-- listing page fell back to the seeded placeholder number (+9190000000xx)
-- instead of the number scraped from the post. Open mode never hit this because
-- service-role bypasses RLS.
--
-- Two SECURITY DEFINER functions close it without opening the table: one says
-- whether a listing is sourced at all (a bare boolean, safe for anyone), the
-- other returns ONLY the name + phone — never the note — and only to an admin,
-- the poster, or a tenant holding an exchange on that listing.
-- ============================================================================

create or replace function public.listing_is_sourced(p_property uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.listing_sources where property_id = p_property);
$$;

create or replace function public.listing_contact_for_viewer(p_property uuid)
returns table (source_name text, source_phone text)
language sql
security definer
stable
set search_path = public
as $$
  select ls.source_name, ls.source_phone
  from public.listing_sources ls
  where ls.property_id = p_property
    and (
      public.is_admin()
      or exists (
        select 1 from public.properties pr
        where pr.id = p_property and pr.posted_by = auth.uid()
      )
      or exists (
        select 1 from public.contact_exchanges ce
        where ce.property_id = p_property and ce.tenant_id = auth.uid()
      )
    );
$$;

grant execute on function public.listing_is_sourced(uuid) to anon, authenticated;
grant execute on function public.listing_contact_for_viewer(uuid) to authenticated;
