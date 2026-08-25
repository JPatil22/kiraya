-- ---------------------------------------------------------------------------
-- 0026 — Somewhere to send it
--
-- 0025 gave the product a clock, and the first sweep immediately proved the
-- next problem: it nudged a broker about two decaying listings, and the notice
-- waits in-app for them to come back. A poster who reliably comes back does not
-- have stale listings. The notification system has been well built and mute
-- since 0012 — six kinds, all written by triggers, none of which can reach
-- anybody who is not already looking at the page.
--
-- Email rather than SMS, first, for a boring reason: SMS needs the DLT
-- registration that already blocks launch, and email needs nobody's permission.
-- When the sender does land, it becomes a second delivery step over the same
-- queue rather than a rewrite.
--
-- ## Two columns and a guard
--
-- `profiles.email` is optional and always will be. Phone is the identity bar
-- (PRD §5 — no Aadhaar, no documents), and email is a delivery preference, not
-- a second proof of who somebody is. Nothing gates on having one.
--
-- `notifications.emailed_at` is the queue. Null means unsent; stamping it is
-- what stops a second delivery run repeating the same message. That makes it a
-- column worth lying about, which is the reason for the trigger below.
--
-- ## Why the update guard exists now and not in 0012
--
-- 0012 says "marking read is the ONLY update anyone may make" and enforces it
-- with an RLS policy — which cannot restrict *which columns* an update touches,
-- only which rows. Until now the gap was harmless: the sole other column worth
-- writing was `read_at` itself. `emailed_at` changes that. Anyone could clear it
-- on their whole history and make the next run re-send every notice they have
-- ever received, at our expense and their own inbox's. Same shape of hole 0017
-- found in mismatch replies, same fix: a trigger pins the update to one column.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists email text;

alter table public.profiles
  drop constraint if exists profiles_email_shape;

alter table public.profiles
  add constraint profiles_email_shape
  check (email is null or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');

comment on column public.profiles.email is
  'Optional delivery address. Phone remains the identity bar; nothing gates on having this.';

alter table public.notifications
  add column if not exists emailed_at timestamptz;

comment on column public.notifications.emailed_at is
  'When this was delivered by email. Null means still queued. Only a trusted context may write it.';

-- The delivery run reads exactly this: unsent, newest first, bounded.
create index if not exists notifications_pending_email_idx
  on public.notifications (created_at)
  where emailed_at is null;

-- ---------------------------------------------------------------------------
-- Marking read really is the only update anyone may make
-- ---------------------------------------------------------------------------
create or replace function public.notifications_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The delivery run writes emailed_at with the service-role key, where
  -- auth.uid() is null. That is the trusted context, exactly as in
  -- properties_guard; what is left is what we mean to constrain.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.user_id    is distinct from old.user_id
     or new.kind    is distinct from old.kind
     or new.body    is distinct from old.body
     or new.property_id is distinct from old.property_id
     or new.created_at  is distinct from old.created_at
     or new.emailed_at  is distinct from old.emailed_at then
    raise exception 'A notification can only be marked read.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists notifications_guard_bu on public.notifications;

create trigger notifications_guard_bu
  before update on public.notifications
  for each row execute function public.notifications_guard();
