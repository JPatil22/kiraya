-- ============================================================================
-- 0037_ingest_photos.sql — a holding pen for photos scraped from a source post
-- before a human has said which room each one shows.
--
-- The Chrome ingestor (chrome-extension/) sends a Facebook post's text and its
-- photos to /api/ingest. The text becomes a `pending_review` listing straight
-- away, but the photos can't: `property_photos` demands a room_type, and a
-- scraped photo has no honest label — nobody has looked at it and said "kitchen".
-- Auto-filing them into room slots would fake the coverage signal that the whole
-- product leans on ("4 of 5 rooms shown"). So they wait here, untagged and
-- deliberately outside the room-coverage maths, until the poster or an admin
-- opens the listing's photo page and assigns each to a real slot — at which
-- point a genuine property_photos row is created and the staging row is deleted.
--
-- Same storage bucket as the real photos (listing-photos, 0006); the object is
-- uploaded once and its key is simply reused on assignment, never re-uploaded.
-- ============================================================================

create table public.ingest_photos (
  id             uuid primary key default gen_random_uuid(),
  property_id    uuid not null references public.properties (id) on delete cascade,
  storage_path   text not null,
  thumbnail_path text,
  -- The post this photo was pulled from — provenance, mirrors listing_sources.
  source_url     text check (char_length(source_url) <= 500),
  created_by     uuid not null references public.profiles (id),
  created_at     timestamptz not null default now()
);

create index ingest_photos_property_idx on public.ingest_photos (property_id);

-- ---------------------------------------------------------------------------
-- RLS. These are unpublished photos on someone's not-yet-live listing, so the
-- read/write surface is exactly the listing's poster and admins — the same
-- shape as listing_sources (0034). No public/tenant policy: a tenant has no
-- business seeing a listing's photos before it is live and tagged. Open mode
-- (service-role, auth.uid() null) bypasses RLS, which is where ingestion runs.
-- ---------------------------------------------------------------------------
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
