-- ============================================================================
-- Kiraya - migration 0030.
--
--   0030  GOOGLE TO SIGN IN, PHONE TO TRANSACT. Adds a 'phone' onboarding step
--         and profiles.phone_verified_at, and teaches handle_new_user to carry
--         across an OAuth email. Phone OTP is NOT deleted - it becomes the
--         step that verifies a number, once a DLT sender exists.
--
-- Your database already has 0001-0029. Paste into the Supabase SQL editor and
-- Run. Safe to run more than once.
--
-- ALSO REQUIRED, in the dashboard - the migration alone does not switch it on:
--
--   1. Authentication -> Providers -> Google -> enable, and paste a Client ID
--      and Client Secret from a Google Cloud OAuth 2.0 Web client.
--   2. In Google Cloud, that client's Authorised redirect URI must be your
--      Supabase callback:
--        https://<project-ref>.supabase.co/auth/v1/callback
--   3. Authentication -> URL Configuration -> Redirect URLs: add
--        http://localhost:3000/auth/callback
--      and your production equivalent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0030 — Google to sign in, phone to transact
--
-- Phone OTP has been the only way into this product since 0001, and it has
-- never once delivered a code: an India rollout needs a DLT-registered sender,
-- which does not exist yet. So the front door has been shut for the entire life
-- of the project, and open mode has been holding it open from the inside.
--
-- Google sign-in opens it today. Free, no registration, no per-message cost,
-- and no rate-limit abuse surface on an endpoint strangers must be able to hit.
--
-- ## But it does not replace the phone number
--
-- Google verifies an email, and email is free to create in bulk. This product's
-- entire trust argument is that the people in it are real, and its core loop —
-- the contact exchange in 0010 — exists to hand two people each other's phone
-- numbers so they can ring one another, which is how Indian rentals actually
-- work. PRD §5 rules out in-app chat as the alternative on purpose.
--
-- So the two are split by what they are for. Google gets you *in*. A phone
-- number is required before you can *transact*: post a listing, or unlock
-- somebody's contact details. Browsing needs neither, and never did — the feed
-- is public.
--
-- ## Provided is not verified
--
-- A number typed into a form is a claim, exactly like a brokerage figure or a
-- captured_at date, and this codebase does not let a claim wear the clothes of
-- a verified fact. `phone_verified_at` stays null until an OTP round trip
-- stamps it, which needs the DLT sender that does not exist yet. The UI can
-- then say "phone provided" rather than "phone verified", which is the truth.
--
-- The OTP funnel itself is NOT deleted — same treatment as when open mode
-- deferred it. `(auth)/login`, `(auth)/verify` and the actions stay intact, and
-- become the verification step for a number somebody has already given us.
-- ---------------------------------------------------------------------------

-- Must be its own statement, and cannot be *used* until this commits. Nothing
-- below uses it: the function bodies resolve the literal at run time.
alter type public.onboarding_step add value if not exists 'phone' after 'role';

alter table public.profiles
  add column if not exists phone_verified_at timestamptz;

comment on column public.profiles.phone_verified_at is
  'When an OTP round trip proved this number. Null means the owner typed it and nobody has checked — a claim, not a fact.';

-- ---------------------------------------------------------------------------
-- Carry across whatever the provider gave us
--
-- 0001 copied `new.phone`, which is what OTP populates. An OAuth sign-up has no
-- phone and does have an email, and the email is worth keeping: 0026 made it
-- the delivery address for notifications, so a Google user is reachable from
-- the moment they arrive without being asked twice for something they already
-- told Google.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, phone, email, phone_verified_at)
  values (
    new.id,
    new.phone,
    -- Supabase lower-cases provider emails already; be explicit anyway.
    nullif(lower(new.email), ''),
    -- A phone that arrived via OTP is verified by definition. One that arrives
    -- any other way is not.
    case when new.phone is not null then now() else null end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
