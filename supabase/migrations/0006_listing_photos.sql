-- ============================================================================
-- 0006_listing_photos.sql — Listing photos
-- A photo is evidence, so it carries its own author and its own capture date:
-- a fresh price next to a two-year-old photo is exactly the mismatch this
-- product exists to surface. Files live in the `listing-photos` bucket.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- property_photos
-- ---------------------------------------------------------------------------
create table public.property_photos (
  id          uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,

  -- Object key inside the `listing-photos` bucket: "<property_id>/<uuid>.<ext>".
  storage_path text not null unique,
  caption      text check (char_length(caption) <= 140),

  -- Lowest sort_order is the cover shot.
  sort_order   int not null default 0 check (sort_order >= 0),

  -- When the photo was TAKEN, not when it was uploaded. Null = unknown, which
  -- the UI shows as "date not given" rather than pretending it's current.
  captured_at  date,

  created_by   uuid not null references public.profiles (id),
  created_at   timestamptz not null default now()
);

create index property_photos_property_idx on public.property_photos (property_id, sort_order);

-- Cap the gallery. Volume is not the product; eight is plenty for one unit.
create or replace function public.property_photos_limit()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.property_photos where property_id = new.property_id) >= 8 then
    raise exception 'A listing can have at most 8 photos' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger property_photos_limit_bi
  before insert on public.property_photos
  for each row execute function public.property_photos_limit();

-- ---------------------------------------------------------------------------
-- RLS — mirrors properties: visible if the listing is, writable by its poster.
-- ---------------------------------------------------------------------------
alter table public.property_photos enable row level security;

create policy property_photos_select on public.property_photos
  for select using (
    exists (
      select 1 from public.properties pr
      where pr.id = property_id
        and (pr.status = 'live' or pr.posted_by = auth.uid() or public.is_admin())
    )
  );

create policy property_photos_insert on public.property_photos
  for insert with check (
    created_by = auth.uid()
    and (
      public.is_admin()
      or exists (select 1 from public.properties pr
                 where pr.id = property_id and pr.posted_by = auth.uid())
    )
  );

create policy property_photos_update on public.property_photos
  for update using (
    public.is_admin()
    or exists (select 1 from public.properties pr
               where pr.id = property_id and pr.posted_by = auth.uid())
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.properties pr
               where pr.id = property_id and pr.posted_by = auth.uid())
  );

create policy property_photos_delete on public.property_photos
  for delete using (
    public.is_admin()
    or exists (select 1 from public.properties pr
               where pr.id = property_id and pr.posted_by = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Storage bucket. Public read (these are marketing images on a public feed);
-- writes are scoped to the poster of the property named by the first path
-- segment, so nobody can drop files into someone else's listing folder.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-photos',
  'listing-photos',
  true,
  5242880,                                              -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "listing photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'listing-photos');

create policy "posters upload to their own listing folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'listing-photos'
    and (
      public.is_admin()
      or exists (
        select 1 from public.properties pr
        where pr.id = ((storage.foldername(name))[1])::uuid
          and pr.posted_by = auth.uid()
      )
    )
  );

create policy "posters delete from their own listing folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'listing-photos'
    and (
      public.is_admin()
      or exists (
        select 1 from public.properties pr
        where pr.id = ((storage.foldername(name))[1])::uuid
          and pr.posted_by = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Extend the public read-model with the cover shot and its age.
-- `photo_captured_at` is exposed alongside `last_verified_at` on purpose: the
-- feed can then say "verified 2 days ago, photo from 2023" instead of letting
-- a stale image ride on a fresh verification.
--
-- Dropped and recreated for the same reason as 0003: CREATE OR REPLACE can only
-- append columns, and the cover-photo columns land before `created_at`.
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
  select pp.storage_path, pp.captured_at
  from public.property_photos pp
  where pp.property_id = p.id
  order by pp.sort_order, pp.created_at
  limit 1
) cover on true
left join lateral (
  select count(*)::int as photo_count
  from public.property_photos pp
  where pp.property_id = p.id
) ph on true
where p.status = 'live';

grant select on public.v_listings_public to anon, authenticated;
