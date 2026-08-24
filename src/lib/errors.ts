import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Turn a database error into something a landlord can act on.
 *
 * Actions used to return `error.message` straight through, which meant a real
 * user could be shown `duplicate key value violates unique constraint
 * "property_photos_one_per_room"`. That leaks the schema and tells them nothing
 * about what to do next.
 *
 * The constraints themselves already carry human-written messages — 0008 raises
 * "A 1rk has no separate bedroom", 0009 raises "Only an admin can change
 * verification fields". Those are worth surfacing verbatim. What isn't is
 * Postgres's own machine phrasing, which is what this maps.
 */

/** Constraint name → what the person should understand from it. */
const CONSTRAINT_MESSAGE: Record<string, string> = {
  property_photos_one_per_room:
    "That room already has a photo. Use Replace to swap it for a new one.",
  property_photos_storage_path_key: "That image has already been uploaded.",
  mismatch_reports_one_open: "You've already reported this listing. An admin is reviewing it.",
};

/** Postgres SQLSTATE → a fallback when we don't recognise the constraint. */
const CODE_MESSAGE: Record<string, string> = {
  "23505": "That already exists.",
  "23503": "That refers to something which no longer exists.",
  "23514": "That isn't allowed for this listing.",
  "42501": "You don't have permission to do that.",
};

/**
 * `raise exception ... using errcode` messages are ours and already readable,
 * so they pass through. Postgres's built-in phrasing never does.
 */
function isAuthoredMessage(message: string): boolean {
  return !/violates|constraint|relation|column .* does not exist|permission denied for/i.test(
    message,
  );
}

export function friendlyDbError(error: PostgrestError | { code?: string; message: string }): string {
  const code = "code" in error ? error.code : undefined;
  const message = error.message ?? "";

  for (const [constraint, friendly] of Object.entries(CONSTRAINT_MESSAGE)) {
    if (message.includes(constraint)) return friendly;
  }

  // A check-constraint or raise from one of our own triggers: 0008's room rules
  // and 0009's verification guard both phrase themselves for a person already.
  if (message && isAuthoredMessage(message)) return message;

  return (code && CODE_MESSAGE[code]) ?? "Something went wrong. Try again.";
}
