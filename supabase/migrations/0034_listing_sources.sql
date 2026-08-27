-- ============================================================================
-- 0034_listing_sources.sql — Where a seeded listing came from (private)
--
-- Bootstrapping supply means posting flats sourced from elsewhere — a Facebook
-- group, a broker's own post — before that broker has an account here. The
-- public listing stays honest: it carries the concierge's contact, not a number
-- lifted from someone who never agreed to be listed (see the contact-exchange
-- model — whoever posts is who a tenant reaches).
--
-- But the poster still needs to remember who the flat actually came from, to
-- call them when a tenant bites and to notice when the same broker's number is
-- feeding six listings or reposting one. That belongs somewhere private, not on
-- the public page — so it lives in its own table with its own RLS, readable only
-- by the poster who wrote it and by admins. It is NEVER added to
-- v_listings_public and never travels through a contact exchange.
--
-- One row per property. source_phone is stored as typed (Facebook numbers come
-- in every format); grouping normalises to digits at read time.
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
