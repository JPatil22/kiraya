-- ============================================================================
-- _0037_apply.sql — paste this into the Supabase SQL editor.
--
-- Creates ingest_photos: a holding pen for photos scraped from a source post
-- (via the Chrome ingestor → /api/ingest) that no human has yet assigned to a
-- room. They live outside the room-coverage maths until the poster or an admin
-- tags each on the listing's photo page. Readable/writable only by the listing's
-- poster and by admins. See 0037_ingest_photos.sql for the reasoning.
--
-- NOT idempotent on a re-run (create table / create policy would error if it
-- already exists). Run once. If you must re-run, drop the table first:
--   drop table if exists public.ingest_photos cascade;
-- ============================================================================

create table public.ingest_photos (
  id             uuid primary key default gen_random_uuid(),
  property_id    uuid not null references public.properties (id) on delete cascade,
  storage_path   text not null,
  thumbnail_path text,
  source_url     text check (char_length(source_url) <= 500),
  created_by     uuid not null references public.profiles (id),
  created_at     timestamptz not null default now()
);

create index ingest_photos_property_idx on public.ingest_photos (property_id);

alter table public.ingest_photos enable row level security;

create policy ingest_photos_select on public.ingest_photos
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.properties pr
      where pr.id = property_id and pr.posted_by = auth.uid()
    )
  );

create policy ingest_photos_insert on public.ingest_photos
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

create policy ingest_photos_delete on public.ingest_photos
  for delete using (
    public.is_admin()
    or exists (
      select 1 from public.properties pr
      where pr.id = property_id and pr.posted_by = auth.uid()
    )
  );
