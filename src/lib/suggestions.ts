import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BrokerSuggestion,
  Database,
  ListingPublic,
  Property,
  TenantIntent,
} from "@/types/database";

/**
 * MVP4 — structured, on-platform broker suggestions.
 *
 * The product rule "a suggestion must point at a real, live listing" is
 * enforced by the insert policy in migration 0004, not here. These helpers
 * deliberately avoid `.in()` so they also run against the fixture client.
 */

/** A suggestion paired with the public view of the listing it points at. */
export type SuggestionWithListing = {
  suggestion: BrokerSuggestion;
  listing: ListingPublic | null;
};

/**
 * Active tenant demand in the locality, for brokers to answer.
 * `tenant_intents` holds no contact details by design — PII stays in
 * `profiles`, which brokers cannot read.
 */
export async function getActiveIntents(
  supabase: SupabaseClient<Database>,
  localityId: string,
  /** The viewing broker, whose own intent is demand they cannot answer (0024). */
  viewerId: string,
  limit = 50,
): Promise<TenantIntent[]> {
  const { data } = await supabase
    .from("tenant_intents")
    .select("*")
    .eq("locality_id", localityId)
    .eq("status", "active")
    .neq("tenant_id", viewerId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

/** The broker's own live listings — the only things they may suggest. */
export async function getSuggestableListings(
  supabase: SupabaseClient<Database>,
  brokerId: string,
): Promise<Property[]> {
  const { data } = await supabase
    .from("properties")
    .select("*")
    .eq("posted_by", brokerId)
    .eq("status", "live")
    .order("created_at", { ascending: false });
  return data ?? [];
}

/** Everything this broker has sent, newest first. */
export async function getSentSuggestions(
  supabase: SupabaseClient<Database>,
  brokerId: string,
): Promise<BrokerSuggestion[]> {
  const { data } = await supabase
    .from("broker_suggestions")
    .select("*")
    .eq("broker_id", brokerId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

/**
 * Whether this person holds an intent at all. Since 0024 that is no longer
 * implied by their role, so the nav has to ask rather than assume.
 */
export async function hasIntent(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("tenant_intents")
    .select("id")
    .eq("tenant_id", userId)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

/** The tenant's intents (usually one, newest first). */
export async function getMyIntents(
  supabase: SupabaseClient<Database>,
  tenantId: string,
): Promise<TenantIntent[]> {
  const { data } = await supabase
    .from("tenant_intents")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

/**
 * The tenant's suggestion inbox: every suggestion against any of their intents,
 * hydrated with the public listing so the card shows the same verified cost,
 * freshness and authorship a tenant would see in the feed.
 */
export async function getInbox(
  supabase: SupabaseClient<Database>,
  tenantId: string,
): Promise<SuggestionWithListing[]> {
  const intents = await getMyIntents(supabase, tenantId);
  if (intents.length === 0) return [];

  const perIntent = await Promise.all(
    intents.map(async (intent) => {
      const { data } = await supabase
        .from("broker_suggestions")
        .select("*")
        .eq("tenant_intent_id", intent.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    }),
  );

  const suggestions = perIntent
    .flat()
    .filter((s) => s.status !== "withdrawn")
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

  return Promise.all(
    suggestions.map(async (suggestion) => {
      const { data: listing } = await supabase
        .from("v_listings_public")
        .select("*")
        .eq("id", suggestion.property_id)
        .maybeSingle();
      return { suggestion, listing };
    }),
  );
}
