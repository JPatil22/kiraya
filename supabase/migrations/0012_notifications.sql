-- ---------------------------------------------------------------------------
-- 0012 — Notifications
--
-- Six flows now depend on someone thinking to check a page: an enquiry arrives,
-- a suggestion is accepted, a listing goes stale, a mismatch is reported, a
-- listing is approved, a saved flat changes price. Every one of them was built,
-- works, and tells nobody. The shortlist is the clearest case — it KNOWS
-- something moved and still can't say so.
--
-- ## Why triggers rather than app code
--
-- The events are already recorded by the database: contact_exchanges rows,
-- property_updates rows, mismatch_reports rows. Writing notifications in the
-- server actions would mean every one of those call sites remembering to, and
-- would miss anything written by the seed script, the SQL editor, or a future
-- second client. Same argument as the audit trigger in 0003: if the fact is a
-- row, the consequence belongs next to the row.
--
-- ## Delivery
--
-- In-app only. Email/SMS would need a provider (and, for India, DLT
-- registration), which isn't procured — but that's a delivery layer on top of
-- this table, not a different design. `read_at` is the only state; a
-- notification is a fact that happened, so there is no edit and no delete.
-- ---------------------------------------------------------------------------

create type public.notification_kind as enum (
  'contact_received',    -- someone asked for your number
  'suggestion_received', -- a broker suggested a listing to you
  'suggestion_answered', -- your suggestion was accepted/declined
  'saved_listing_changed', -- a listing you saved moved
  'mismatch_reported',   -- a tenant says your listing didn't match
  'listing_reviewed'     -- an admin approved or rejected your listing
);

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  kind        public.notification_kind not null,
  -- Written at insert time rather than composed on read: what a notification
  -- said should not change later because the underlying row did.
  body        text not null,
  -- Where clicking it should go. Nullable: not every notice has a subject.
  property_id uuid references public.properties (id) on delete cascade,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- The two queries the UI makes: the unread badge, and the list.
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id)
  where read_at is null;

alter table public.notifications enable row level security;

create policy notifications_select_own on public.notifications
  for select using (user_id = auth.uid());

-- Marking read is the ONLY update anyone may make, and only on their own.
-- Without the with-check on user_id a reader could reassign a notification.
create policy notifications_update_own on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- No insert policy at all: every row comes from the SECURITY DEFINER triggers
-- below. Nobody gets to manufacture a notification for someone else.

-- ---------------------------------------------------------------------------
-- Helper — one place that writes the row.
-- ---------------------------------------------------------------------------
create or replace function public.notify(
  p_user     uuid,
  p_kind     public.notification_kind,
  p_body     text,
  p_property uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Never notify someone about their own action: an owner editing their own
  -- listing shouldn't hear back from us about it.
  if p_user is null then return; end if;
  insert into public.notifications (user_id, kind, body, property_id)
  values (p_user, p_kind, p_body, p_property);
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Someone asked for your number (0010).
-- ---------------------------------------------------------------------------
create or replace function public.notify_contact_exchange()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  who   text;
  title text;
begin
  select coalesce(full_name, 'Someone') into who from public.profiles where id = new.tenant_id;
  select p.title into title from public.properties p where p.id = new.property_id;

  perform public.notify(
    new.counterparty_id,
    'contact_received',
    who || ' asked for your number about "' || coalesce(title, 'your listing') || '"',
    new.property_id
  );
  return new;
end;
$$;

create trigger contact_exchanges_notify_ai
  after insert on public.contact_exchanges
  for each row execute function public.notify_contact_exchange();

-- ---------------------------------------------------------------------------
-- 2. A broker suggested you a listing / 3. a tenant answered (0004).
-- ---------------------------------------------------------------------------
create or replace function public.notify_suggestion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tenant uuid;
  title  text;
  who    text;
begin
  select ti.tenant_id into tenant
  from public.tenant_intents ti where ti.id = new.tenant_intent_id;
  select p.title into title from public.properties p where p.id = new.property_id;

  if tg_op = 'INSERT' then
    perform public.notify(
      tenant, 'suggestion_received',
      'A broker suggested "' || coalesce(title, 'a listing') || '" for you',
      new.property_id
    );

  elsif new.status is distinct from old.status
    and new.status in ('accepted', 'declined', 'not_relevant') then
    select coalesce(full_name, 'A tenant') into who from public.profiles where id = tenant;
    perform public.notify(
      new.broker_id, 'suggestion_answered',
      who || ' marked your suggestion ' || replace(new.status::text, '_', ' '),
      new.property_id
    );
  end if;

  return new;
end;
$$;

create trigger broker_suggestions_notify_aiu
  after insert or update on public.broker_suggestions
  for each row execute function public.notify_suggestion();

-- ---------------------------------------------------------------------------
-- 4. A listing you saved changed (0003 + 0011).
--
-- This is the one that could not exist before: property_updates says what
-- moved, shortlists says who cares, and the fan-out joins them. Verification
-- restamps are skipped for the same reason the shortlist page skips them —
-- "still true" is reassurance, not news.
-- ---------------------------------------------------------------------------
create or replace function public.notify_saved_listing_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  title text;
  saver record;
begin
  if new.kind = 'verification' then return new; end if;

  select p.title into title from public.properties p where p.id = new.property_id;

  for saver in
    select s.user_id from public.shortlists s where s.property_id = new.property_id
  loop
    -- Don't tell someone about a change they made themselves.
    if saver.user_id is distinct from new.changed_by then
      perform public.notify(
        saver.user_id, 'saved_listing_changed',
        'A listing you saved changed: ' || new.field || ' is now ' ||
          coalesce(new.new_value, 'unset') || ' (was ' || coalesce(new.old_value, 'unset') || ')',
        new.property_id
      );
    end if;
  end loop;

  return new;
end;
$$;

create trigger property_updates_notify_ai
  after insert on public.property_updates
  for each row execute function public.notify_saved_listing_changed();

-- ---------------------------------------------------------------------------
-- 5. A tenant reported your listing (0003).
-- ---------------------------------------------------------------------------
create or replace function public.notify_mismatch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  poster uuid;
  title  text;
begin
  select p.posted_by, p.title into poster, title
  from public.properties p where p.id = new.property_id;

  -- Deliberately does not name the reporter: a report is not an introduction.
  perform public.notify(
    poster, 'mismatch_reported',
    'Someone reported that "' || coalesce(title, 'your listing') ||
      '" did not match reality (' || replace(new.type::text, '_', ' ') || ')',
    new.property_id
  );
  return new;
end;
$$;

create trigger mismatch_reports_notify_ai
  after insert on public.mismatch_reports
  for each row execute function public.notify_mismatch();

-- ---------------------------------------------------------------------------
-- 6. An admin approved or rejected your listing (0002/0005).
-- ---------------------------------------------------------------------------
create or replace function public.notify_listing_reviewed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is not distinct from old.status then return new; end if;

  if new.status = 'live' then
    perform public.notify(new.posted_by, 'listing_reviewed',
      '"' || new.title || '" is live and verified', new.id);
  elsif new.status = 'rejected' then
    perform public.notify(new.posted_by, 'listing_reviewed',
      '"' || new.title || '" was not approved. An admin has left a note.', new.id);
  elsif new.status = 'archived' then
    perform public.notify(new.posted_by, 'listing_reviewed',
      '"' || new.title || '" was taken down', new.id);
  end if;

  return new;
end;
$$;

create trigger properties_notify_au
  after update on public.properties
  for each row execute function public.notify_listing_reviewed();
