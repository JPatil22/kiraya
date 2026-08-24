-- ============================================================================
-- Kiraya — migration 0013 ONLY (format money in notification bodies).
-- Follow-up to 0012. Replaces functions only — safe to run more than once.
-- Paste into the Supabase SQL editor (Project -> SQL Editor -> New query -> Run).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0013 — Format money in notification bodies
--
-- 0012's fan-out composed "rent is now 34000 (was 30000)". Every other surface
-- in the product renders that as ₹34,000, and money presentation is not a
-- detail here — the whole cost-transparency argument rests on numbers being
-- legible at a glance. A notification is often the first thing someone reads
-- about a price change, so it's the worst place to show a bare integer.
--
-- Indian digit grouping (1,50,000 — not 150,000) has no `to_char` mask, so it
-- needs the small helper below. Replaces two functions; safe to re-run.
-- ---------------------------------------------------------------------------

create or replace function public.format_inr(p_amount bigint)
returns text
language plpgsql
immutable
as $$
declare
  digits text := abs(p_amount)::text;
  head   text;
  tail   text;
  groups text := '';
begin
  -- Last three digits, then twos: 1234567 -> 12,34,567.
  if length(digits) <= 3 then
    return case when p_amount < 0 then '-₹' else '₹' end || digits;
  end if;

  tail := right(digits, 3);
  head := left(digits, length(digits) - 3);

  while length(head) > 2 loop
    groups := ',' || right(head, 2) || groups;
    head   := left(head, length(head) - 2);
  end loop;

  return case when p_amount < 0 then '-₹' else '₹' end || head || groups || ',' || tail;
end;
$$;

-- Which `property_updates.field` values are rupee amounts. Anything else (a
-- date, an availability enum) is passed through as written.
create or replace function public.format_update_value(p_field text, p_value text)
returns text
language plpgsql
immutable
as $$
begin
  if p_value is null then
    return 'unset';
  end if;

  if p_field in ('rent', 'deposit', 'maintenance_monthly', 'brokerage', 'one_time_charges')
     and p_value ~ '^-?\d+$' then
    return public.format_inr(p_value::bigint);
  end if;

  -- Enum-ish values read better with spaces: on_hold -> "on hold".
  return replace(p_value, '_', ' ');
end;
$$;

create or replace function public.notify_saved_listing_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  title text;
  saver record;
  label text;
begin
  if new.kind = 'verification' then return new; end if;

  select p.title into title from public.properties p where p.id = new.property_id;
  label := replace(new.field, '_', ' ');

  for saver in
    select s.user_id from public.shortlists s where s.property_id = new.property_id
  loop
    -- Don't tell someone about a change they made themselves.
    if saver.user_id is distinct from new.changed_by then
      perform public.notify(
        saver.user_id,
        'saved_listing_changed',
        'A listing you saved changed: ' || label || ' is now ' ||
          public.format_update_value(new.field, new.new_value) ||
          ' (was ' || public.format_update_value(new.field, new.old_value) || ')',
        new.property_id
      );
    end if;
  end loop;

  return new;
end;
$$;
