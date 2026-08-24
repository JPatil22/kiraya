-- ---------------------------------------------------------------------------
-- 0015 — Post-visit feedback
--
-- Until now the only way this product learned a listing was wrong was a
-- mismatch report — which fires only when someone is annoyed enough to
-- complain. So the accuracy data was made entirely of angry people. The tenant
-- whose visit was fine, and the tenant who found the rent ₹2,000 higher and
-- simply walked away, both left no trace.
--
-- `contact_exchanges` (0010) already records exactly who got which number and
-- when. That's an invitation to ask the one question that turns "verified"
-- from something asserted into something measured: did you go, and was it as
-- described?
--
-- ## Shape
--
-- One answer per exchange, and `did_not_visit` is a first-class outcome rather
-- than a missing row. That distinction matters: "went and it was wrong" and
-- "never went" must not average together, or every listing whose enquirers were
-- simply busy would look inaccurate.
--
-- Answers are editable by the person who gave them. A three-tap control invites
-- mis-taps, and a trust signal built on answers people can't correct is a worse
-- signal, not a purer one.
--
-- ## Visibility
--
-- Deliberately closed for now: the tenant who answered, and admins. Whether an
-- aggregate should surface publicly on the listing is a product decision still
-- open — and widening this later is a one-line policy change, whereas narrowing
-- it after people have answered under one expectation is not.
-- ---------------------------------------------------------------------------

create type public.visit_outcome as enum (
  'as_described',   -- went, and it matched
  'did_not_match',  -- went, and it did not
  'unreachable',    -- never got hold of them
  'did_not_visit'   -- did not go; carries no signal about the listing
);

create table public.visit_feedback (
  id                  uuid primary key default gen_random_uuid(),
  -- The exchange is the invitation, so it's the natural key: no exchange, no
  -- standing to answer.
  contact_exchange_id uuid not null references public.contact_exchanges (id) on delete cascade,
  property_id         uuid not null references public.properties (id) on delete cascade,
  tenant_id           uuid not null references public.profiles (id) on delete cascade,
  outcome             public.visit_outcome not null,
  note                text check (char_length(note) <= 500),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  unique (contact_exchange_id)
);

create index visit_feedback_property_idx on public.visit_feedback (property_id, outcome);
create index visit_feedback_tenant_idx on public.visit_feedback (tenant_id, created_at desc);

create trigger visit_feedback_set_updated_at
  before update on public.visit_feedback
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Guard: you may only answer for an exchange that is yours, and the row must
-- describe that exchange. Without this the insert policy alone would let a
-- tenant file feedback against any listing they liked.
-- ---------------------------------------------------------------------------
create or replace function public.visit_feedback_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ex record;
begin
  select tenant_id, property_id into ex
  from public.contact_exchanges where id = new.contact_exchange_id;

  if ex is null then
    raise exception 'That contact exchange does not exist' using errcode = '23503';
  end if;

  if new.tenant_id <> ex.tenant_id then
    raise exception 'You can only answer for your own enquiry' using errcode = '42501';
  end if;

  if new.property_id <> ex.property_id then
    raise exception 'That feedback does not match the listing you enquired about'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger visit_feedback_guard_biu
  before insert or update on public.visit_feedback
  for each row execute function public.visit_feedback_guard();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.visit_feedback enable row level security;

create policy visit_feedback_select_own on public.visit_feedback
  for select using (tenant_id = auth.uid() or public.is_admin());

create policy visit_feedback_insert_own on public.visit_feedback
  for insert with check (tenant_id = auth.uid());

-- Correcting a mis-tap is allowed; reassigning it to someone else is not.
create policy visit_feedback_update_own on public.visit_feedback
  for update using (tenant_id = auth.uid()) with check (tenant_id = auth.uid());

-- No delete policy. Withdrawing an answer would let someone erase a signal the
-- moment it counted against a listing they later warmed to.

-- ---------------------------------------------------------------------------
-- Accuracy per listing, for whoever is eventually allowed to see it.
--
-- `did_not_visit` is excluded from the denominator on purpose — it says nothing
-- about the listing. `unreachable` IS counted, because a poster who never picks
-- up is a real failure of the thing this product promises.
-- ---------------------------------------------------------------------------
create or replace view public.v_listing_accuracy as
select
  vf.property_id,
  count(*) filter (where vf.outcome <> 'did_not_visit')        as answered,
  count(*) filter (where vf.outcome = 'as_described')          as matched,
  count(*) filter (where vf.outcome = 'did_not_match')         as mismatched,
  count(*) filter (where vf.outcome = 'unreachable')           as unreachable,
  count(*) filter (where vf.outcome = 'did_not_visit')         as did_not_visit
from public.visit_feedback vf
group by vf.property_id;

grant select on public.v_listing_accuracy to authenticated;
