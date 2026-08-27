-- ============================================================================
-- _0034_apply.sql — paste this into the Supabase SQL editor.
--
-- Creates listing_sources: a private, per-listing note of who a seeded flat was
-- sourced from (name + phone), readable only by the listing's poster and by
-- admins, never exposed to tenants and never part of a contact exchange. See
-- 0034_listing_sources.sql for the reasoning.
--
-- NOT idempotent on a re-run (create table / create policy would error if it
-- already exists). Run once. If you must re-run, drop the table first:
--   drop table if exists public.listing_sources cascade;
-- ============================================================================

create table public.listing_sources (
  property_id  uuid primary key references public.properties (id) on delete cascade,
  source_name  text check (char_length(source_name) <= 120),
  source_phone text check (char_length(source_phone) <= 40),
  note         text check (char_length(note) <= 500),
  created_by   uuid not null references public.profiles (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Grouping by broker number is the point, so index the normalised digits.
create index listing_sources_phone_idx
  on public.listing_sources ((regexp_replace(coalesce(source_phone, ''), '\D', '', 'g')));

-- ---------------------------------------------------------------------------
-- RLS. This holds third-party personal data that must not leak, so the default
-- is deny and only the poster of the property (or an admin) may touch it. There
-- is deliberately no public/tenant read policy at all — the only way a number
-- here reaches a tenant is if someone writes SQL to put it in a public view,
-- and nobody should.
-- ---------------------------------------------------------------------------
alter table public.listing_sources enable row level security;

create policy listing_sources_select on public.listing_sources
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.properties pr
      where pr.id = property_id and pr.posted_by = auth.uid()
    )
  );

create policy listing_sources_insert on public.listing_sources
  for insert with check (
    created_by = auth.uid()
    and (
      public.is_admin()
      or exists (
        select 1 from public.properties pr
        where pr.id = property_id and pr.posted_by = auth.uid()
      )
    )
  );

create policy listing_sources_update on public.listing_sources
  for update using (
    public.is_admin()
    or exists (
      select 1 from public.properties pr
      where pr.id = property_id and pr.posted_by = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.properties pr
      where pr.id = property_id and pr.posted_by = auth.uid()
    )
  );

create policy listing_sources_delete on public.listing_sources
  for delete using (
    public.is_admin()
    or exists (
      select 1 from public.properties pr
      where pr.id = property_id and pr.posted_by = auth.uid()
    )
  );
