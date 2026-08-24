-- ============================================================================
-- 0001_core_mvp1.sql — Identity & Intent (MVP1)
-- profiles, localities, tenant_intents + enums + RLS + onboarding plumbing.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role       as enum ('tenant', 'owner', 'broker', 'admin');
create type public.onboarding_step as enum ('role', 'intent', 'done');
create type public.bhk_type        as enum ('1rk', '1bhk', '2bhk', '3bhk', '4plus');
create type public.furnishing_type as enum ('unfurnished', 'semi', 'full');
create type public.occupancy_type  as enum ('family', 'bachelors_male', 'bachelors_female', 'any');
create type public.intent_status   as enum ('active', 'paused', 'fulfilled');

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------
-- Bump updated_at on any row update.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- localities — the platform serves ONE at a time, but the table lets us pin
-- config (staleness window) and, later, expand.
-- ---------------------------------------------------------------------------
create table public.localities (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  name              text not null,
  city              text not null,
  state             text,
  verify_stale_days int  not null default 7 check (verify_stale_days between 1 and 90),
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- profiles — 1:1 with auth.users. `role` is null until the user picks one.
-- `onboarding_step` is the state machine the middleware routes on.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  phone              text,
  full_name          text,
  role               public.user_role,
  onboarding_step    public.onboarding_step not null default 'role',
  active_locality_id uuid references public.localities (id),
  is_suspended       boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Admin check used across every policy. SECURITY DEFINER + owned by postgres
-- so it bypasses RLS on profiles (no recursive policy evaluation).
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Auto-create a profile whenever a new auth user is created (phone signup).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, phone)
  values (new.id, new.phone)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- tenant_intents — the structured demand signal (MVP1 core deliverable).
-- Budget in integer rupees. No contact info here; PII stays in profiles.
-- ---------------------------------------------------------------------------
create table public.tenant_intents (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.profiles (id) on delete cascade,
  locality_id  uuid not null references public.localities (id),
  budget_min   int  not null check (budget_min >= 0),
  budget_max   int  not null check (budget_max >= budget_min),
  bhk          public.bhk_type not null,
  move_in_date date not null,
  furnishing   public.furnishing_type not null default 'semi',
  occupancy    public.occupancy_type  not null default 'any',
  notes        text check (char_length(notes) <= 500),
  status       public.intent_status   not null default 'active',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index tenant_intents_tenant_idx   on public.tenant_intents (tenant_id);
create index tenant_intents_locality_idx on public.tenant_intents (locality_id, status);

create trigger tenant_intents_set_updated_at
  before update on public.tenant_intents
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.localities     enable row level security;
alter table public.profiles       enable row level security;
alter table public.tenant_intents enable row level security;

-- localities: world-readable reference data; admin writes.
create policy localities_read_all on public.localities
  for select using (true);
create policy localities_admin_write on public.localities
  for all using (public.is_admin()) with check (public.is_admin());

-- profiles: read/insert/update self; admin everything.
create policy profiles_select_self on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy profiles_insert_self on public.profiles
  for insert with check (id = auth.uid());
-- Users may edit themselves but may NOT self-promote to admin.
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (
    public.is_admin()
    or (id = auth.uid() and role is distinct from 'admin')
  );

-- tenant_intents: owner tenant + admin (broker read is added in 0004).
create policy intents_select_own on public.tenant_intents
  for select using (tenant_id = auth.uid() or public.is_admin());
create policy intents_insert_own on public.tenant_intents
  for insert with check (tenant_id = auth.uid());
create policy intents_update_own on public.tenant_intents
  for update using (tenant_id = auth.uid() or public.is_admin())
  with check (tenant_id = auth.uid() or public.is_admin());
create policy intents_delete_own on public.tenant_intents
  for delete using (tenant_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Seed the launch locality (matches NEXT_PUBLIC_ACTIVE_LOCALITY_SLUG).
-- ---------------------------------------------------------------------------
insert into public.localities (slug, name, city, state, verify_stale_days)
values ('hsr-layout', 'HSR Layout', 'Bengaluru', 'Karnataka', 7)
on conflict (slug) do nothing;
