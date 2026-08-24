-- ============================================================================
-- Kiraya — migration 0011 ONLY (shortlists / saved listings).
-- Your database already has 0001–0010. Paste this into the Supabase SQL editor
-- (Project -> SQL Editor -> New query -> Run). Run once.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0011 — Shortlists
--
-- A tenant compares five flats, likes three, and had no way to keep them: every
-- session started from nothing. This is the bookmark table behind that.
--
-- It earns its place beyond "saved items" because of what sits next to it.
-- `property_updates` (0003) records every change with a timestamp, so a saved
-- row's `created_at` is a watermark: anything logged after it is something that
-- moved WHILE the tenant was thinking about it. The shortlist can therefore say
-- "the rent went up ₹2,000 since you saved this" instead of just listing links
-- — which is the same freshness promise the feed makes, pointed at the handful
-- of listings someone actually cares about.
--
-- Not restricted to tenants. A broker saving listings to suggest, or an owner
-- watching what comparable flats are asking, are both legitimate; gating it by
-- role would add a rule with nothing behind it.
-- ---------------------------------------------------------------------------

create table public.shortlists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  property_id uuid not null references public.properties (id) on delete cascade,
  created_at  timestamptz not null default now(),

  -- Saving twice is the same save. Also what makes the toggle idempotent.
  unique (user_id, property_id)
);

-- The shortlist page reads "everything I saved, newest first".
create index shortlists_user_idx on public.shortlists (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS — a shortlist is private. Not even the listing's owner learns who saved
-- it: that would turn a private "maybe" into a lead the tenant never offered.
-- Contact is the deliberate, recorded step for that (0010).
-- ---------------------------------------------------------------------------
alter table public.shortlists enable row level security;

create policy shortlists_select_own on public.shortlists
  for select using (user_id = auth.uid());

-- Only live listings can be saved — there is nothing to come back to otherwise.
create policy shortlists_insert_own on public.shortlists
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.properties p
      where p.id = property_id and p.status = 'live'
    )
  );

create policy shortlists_delete_own on public.shortlists
  for delete using (user_id = auth.uid());

-- No update policy: a save has no fields worth changing. Un-saving is a delete.
-- Deliberately no admin policy either — admins moderate listings, not the
-- private lists people keep of them.
