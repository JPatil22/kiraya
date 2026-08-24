-- ============================================================================
-- Kiraya — migration 0022 (follow-up to 0020).
-- Replaces one function. Safe to run more than once.
-- Paste into the Supabase SQL editor and Run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0022 — Fix who hears about a visit status change
--
-- 0020 decided the recipient with `case when auth.uid() = new.tenant_id then
-- host else tenant end`. Under service-role — which is what open mode runs as —
-- `auth.uid()` is null, so the comparison is NULL rather than false, the CASE
-- falls to its ELSE, and the tenant is told about their own action.
--
-- The fix leans on something the data already knows instead of on the session:
-- only the person who did NOT propose a visit can confirm or decline it, so for
-- those two outcomes the proposer is the recipient by definition. Cancelling is
-- the only genuinely ambiguous case, and that still consults `auth.uid()` when
-- there is one, falling back to the proposer when there isn't.
-- ---------------------------------------------------------------------------

create or replace function public.notify_visit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  title  text;
  who    text;
  target uuid;
begin
  select p.title into title from public.properties p where p.id = new.property_id;

  if tg_op = 'INSERT' then
    target := case when new.proposed_by = new.tenant_id then new.host_id else new.tenant_id end;
    select coalesce(full_name, 'Someone') into who
    from public.profiles where id = new.proposed_by;

    perform public.notify(
      target, 'visit_proposed',
      who || ' proposed a visit to "' || coalesce(title, 'your listing') || '" on ' ||
        to_char(new.scheduled_for, 'FMDay FMDD Mon at HH12:MIam'),
      new.property_id
    );

  elsif new.status is distinct from old.status then
    target := case
      -- Only the other side can confirm or decline, so the proposer is the one
      -- waiting to hear. True regardless of who the session says is acting.
      when new.status in ('confirmed', 'declined') then new.proposed_by
      -- Either party may cancel; use the session when we have one.
      when auth.uid() = new.tenant_id then new.host_id
      when auth.uid() = new.host_id   then new.tenant_id
      else new.proposed_by
    end;

    perform public.notify(
      target, 'visit_answered',
      'A visit to "' || coalesce(title, 'a listing') || '" was ' || new.status::text,
      new.property_id
    );
  end if;

  return new;
end;
$$;
