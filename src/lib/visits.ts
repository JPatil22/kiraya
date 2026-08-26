import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ListingAccuracy, PublicAccuracy, VisitFeedback, VisitOutcome } from "@/types/database";
import { logRead } from "@/lib/errors";

/**
 * Post-visit feedback (0015) — the loop that turns "verified" from something
 * asserted into something measured.
 */

/**
 * How long to leave someone alone after they get a number.
 *
 * Long enough that they've plausibly been, short enough that they remember. The
 * ask surfaces in-app rather than as a scheduled push, because there's no
 * scheduler here — which also means it arrives when they're already looking at
 * the product rather than interrupting them.
 */
export const ASK_AFTER_DAYS = 3;

export const OUTCOME_LABEL: Record<VisitOutcome, string> = {
  as_described: "Yes, as described",
  did_not_match: "It didn't match",
  unreachable: "Couldn't reach them",
  did_not_visit: "I didn't go",
};

export type PendingAsk = {
  contactExchangeId: string;
  propertyId: string;
  propertyTitle: string | null;
  askedAt: string;
};

/**
 * Enquiries old enough to ask about, that haven't been answered.
 *
 * Two queries and a difference rather than a NOT EXISTS join: `visit_feedback`
 * is readable only through its own policy, and PostgREST embedding across a
 * policy-gated relationship returns nulls instead of failing, which would
 * silently make everything look unanswered.
 */
export async function getPendingAsks(
  supabase: SupabaseClient<Database>,
  tenantId: string,
): Promise<PendingAsk[]> {
  const cutoff = new Date(Date.now() - ASK_AFTER_DAYS * 86_400_000).toISOString();

  const [{ data: exchanges }, { data: answered }] = await Promise.all([
    supabase
      .from("contact_exchanges")
      .select("id, property_id, created_at")
      .eq("tenant_id", tenantId)
      .lte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("visit_feedback").select("contact_exchange_id").eq("tenant_id", tenantId),
  ]);

  const done = new Set((answered ?? []).map((f) => f.contact_exchange_id));
  const pending = (exchanges ?? []).filter((e) => !done.has(e.id));
  if (pending.length === 0) return [];

  return Promise.all(
    pending.map(async (e) => {
      const { data, error } = await supabase
        .from("properties")
        .select("title")
        .eq("id", e.property_id)
        .maybeSingle();
      logRead("getPendingAsks", error);

      return {
        contactExchangeId: e.id,
        propertyId: e.property_id,
        propertyTitle: data?.title ?? null,
        askedAt: e.created_at,
      };
    }),
  );
}

/** This tenant's own answers, for showing what they already said. */
export async function getMyFeedback(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  propertyId: string,
): Promise<VisitFeedback | null> {
  const { data, error } = await supabase
    .from("visit_feedback")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("property_id", propertyId)
    .maybeSingle();
  logRead("getMyFeedback", error);

  return data ?? null;
}

/** Tallied outcomes for one listing. Null when nobody has answered yet. */
export async function getAccuracy(
  supabase: SupabaseClient<Database>,
  propertyId: string,
): Promise<ListingAccuracy | null> {
  const { data, error } = await supabase
    .from("v_listing_accuracy")
    .select("*")
    .eq("property_id", propertyId)
    .maybeSingle();
  logRead("getAccuracy", error);

  return data ?? null;
}

/**
 * The tally a tenant sees (0031).
 *
 * Null below three answers — the view enforces it, and the UI renders nothing
 * rather than a caveat, because "1 person said it didn't match" is one bad
 * afternoon wearing the clothes of a pattern.
 */
export async function getPublicAccuracy(
  supabase: SupabaseClient<Database>,
  propertyId: string,
): Promise<PublicAccuracy | null> {
  const { data, error } = await supabase
    .from("v_listing_accuracy_public")
    .select("*")
    .eq("property_id", propertyId)
    .maybeSingle();
  logRead("getPublicAccuracy", error);

  return data ?? null;
}
