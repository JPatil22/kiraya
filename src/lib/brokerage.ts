import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, UserRole } from "@/types/database";

/**
 * Brokerage disclosure (0023) — the app-side twin of
 * `properties_brokerage_guard`.
 *
 * **The SQL is the spec.** That trigger runs whatever calls the database, has
 * no `auth.uid()` passthrough, and is the thing that actually holds the line.
 * This exists because a trigger raising 23514 is a terrible way to tell someone
 * they left a field blank: the same two rules are evaluated here so the form
 * can put a message next to the field instead.
 *
 * The rules:
 *   - An **owner** listing carries no brokerage. A fee means somebody is
 *     brokering, and then the broker should be the one posting.
 *   - A **broker** must state the fee. Zero is a fine answer; silence is not,
 *     because a tenant reads an unset column as zero and budgets against it.
 */
export type BrokerageDecision =
  | { ok: true; amount: number; disclosed: boolean }
  | { ok: false; message: string };

export function resolveBrokerage(
  role: UserRole | null,
  amount: number,
  saidNone: boolean,
): BrokerageDecision {
  if (role === "owner") {
    if (amount > 0) {
      return {
        ok: false,
        message:
          "An owner listing can't carry a brokerage fee. If a broker is collecting one, they should be the one posting it.",
      };
    }
    // Nobody is brokering, so "no brokerage" is a fact about the listing rather
    // than a claim the owner has to remember to make.
    return { ok: true, amount: 0, disclosed: true };
  }

  if (role === "broker") {
    // Typing a number *is* the statement — the tick box is only how you say
    // zero on purpose.
    if (amount === 0 && !saidNone) {
      return {
        ok: false,
        message:
          'State the brokerage. Zero is a fine answer — tick "No brokerage on this listing" to say so.',
      };
    }
    return { ok: true, amount, disclosed: true };
  }

  // Admin: the ops and seeding path, deliberately unconstrained. A number is
  // still read as a statement.
  return { ok: true, amount, disclosed: amount > 0 || saidNone };
}

/**
 * The role that judges a listing is the *poster's*, not the editor's — an admin
 * fixing a broker's listing still has to satisfy the broker rule, because the
 * trigger reads `posted_by`.
 */
export async function getPosterRole(
  supabase: SupabaseClient<Database>,
  postedBy: string,
): Promise<UserRole | null> {
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", postedBy)
    .maybeSingle();
  return data?.role ?? null;
}

/** Unticked checkboxes are absent from FormData entirely, not "off". */
export function checkboxOn(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true";
}

/** What the listing claims about brokerage, for the tenant-facing surfaces. */
export type BrokerageClaim = "none" | "charged" | "unstated";

export function brokerageClaim(listing: {
  brokerage: number;
  brokerage_disclosed: boolean;
  posted_by_role: UserRole | null;
}): BrokerageClaim {
  if (listing.brokerage > 0) return "charged";
  if (listing.brokerage_disclosed || listing.posted_by_role === "owner") return "none";
  return "unstated";
}
