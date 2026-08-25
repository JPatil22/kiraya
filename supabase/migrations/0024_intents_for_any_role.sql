-- ---------------------------------------------------------------------------
-- 0024 — A rental intent is not a tenant-only object
--
-- `tenant_intents` has never had a role gate in its policies: 0001 scoped every
-- one of them on `tenant_id = auth.uid()` and nothing else. The restriction was
-- entirely in the app — three `user.role !== 'tenant'` redirects — which meant
-- an owner between places, or a broker who is themselves moving house, could
-- shortlist listings, unlock numbers, report mismatches and schedule visits,
-- but could not say what they were looking for and could not receive a single
-- suggestion. Half the demand side, switched off by an accident of role.
--
-- So the app gates come off. The database needed no permission change for that.
-- What it does need is the invariant that only becomes reachable once a broker
-- can hold an intent: you cannot suggest a listing to yourself.
--
-- ## Why a trigger as well as a policy
--
-- The policy is the security boundary and reads as one. But open mode runs as
-- service-role, where RLS does not apply at all, so a policy alone would leave
-- the rule unenforced in the app as it actually runs today — the same argument
-- 0023 makes for the brokerage guard. Suggesting to yourself is nonsense data
-- rather than a privilege question, so it belongs in a trigger that binds every
-- writer.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- The policy, restated with the self-suggestion clause.
-- ---------------------------------------------------------------------------
drop policy if exists suggestions_insert_broker on public.broker_suggestions;

create policy suggestions_insert_broker on public.broker_suggestions
  for insert with check (
    broker_id = auth.uid()
    and exists (select 1 from public.profiles p
                where p.id = auth.uid() and p.role = 'broker' and p.is_suspended = false)
    and exists (select 1 from public.properties pr
                where pr.id = property_id and pr.status = 'live')
    and exists (select 1 from public.tenant_intents ti
                where ti.id = tenant_intent_id and ti.status = 'active')
    -- 0024: a broker may hold an intent of their own. Answering it themselves
    -- would put a broker's own listing in their own inbox.
    and not exists (select 1 from public.tenant_intents ti
                    where ti.id = tenant_intent_id and ti.tenant_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- The same rule, for every writer.
-- ---------------------------------------------------------------------------
create or replace function public.broker_suggestions_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  intent_holder uuid;
begin
  select tenant_id into intent_holder
  from public.tenant_intents
  where id = new.tenant_intent_id;

  if intent_holder = new.broker_id then
    raise exception 'You cannot send a suggestion to your own rental intent.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger broker_suggestions_guard_biu
  before insert or update on public.broker_suggestions
  for each row execute function public.broker_suggestions_guard();
