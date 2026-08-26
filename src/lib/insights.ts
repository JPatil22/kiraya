import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  DepositContext,
  DuplicateCandidate,
  ListingEngagement,
  PriceContext,
} from "@/types/database";
import { logRead } from "@/lib/errors";

/**
 * Read-side helpers for the two things the product knew but never said:
 * whether a price is normal (0016), and whether a listing is working (0017).
 */

/**
 * Below this many comparable listings, say nothing.
 *
 * With one or two others the honest answer is "we don't know yet", and a
 * confident-sounding percentage drawn from a sample of two is worse than
 * silence — it looks like information.
 */
export const MIN_PRICE_SAMPLE = 3;

/** How far from the median still counts as "about the going rate". */
export const PRICE_NOISE_PCT = 4;

export async function getPriceContext(
  supabase: SupabaseClient<Database>,
  propertyId: string,
): Promise<PriceContext | null> {
  const { data, error } = await supabase
    .from("v_listing_price_context")
    .select("*")
    .eq("property_id", propertyId)
    .maybeSingle();
  logRead("getPriceContext", error);

  if (!data || data.sample < MIN_PRICE_SAMPLE || data.pct_vs_median === null) return null;
  return data;
}

/**
 * The deposit comparison (0032). Same threshold and silence rule as the rent
 * one above — three comparables or nothing.
 */
export async function getDepositContext(
  supabase: SupabaseClient<Database>,
  propertyId: string,
): Promise<DepositContext | null> {
  const { data, error } = await supabase
    .from("v_listing_deposit_context")
    .select("*")
    .eq("property_id", propertyId)
    .maybeSingle();
  logRead("getDepositContext", error);

  if (!data || data.sample < MIN_PRICE_SAMPLE) return null;
  if (data.months === null || data.median_months === null) return null;
  return data;
}

export async function getEngagement(
  supabase: SupabaseClient<Database>,
  propertyId: string,
): Promise<ListingEngagement | null> {
  const { data, error } = await supabase
    .from("v_listing_engagement")
    .select("*")
    .eq("property_id", propertyId)
    .maybeSingle();
  logRead("getEngagement", error);

  return data ?? null;
}

/** Engagement for several listings at once, keyed by property id. */
export async function getEngagementFor(
  supabase: SupabaseClient<Database>,
  posterId: string,
): Promise<Map<string, ListingEngagement>> {
  const { data, error } = await supabase
    .from("v_listing_engagement")
    .select("*")
    .eq("posted_by", posterId);
  logRead("getEngagementFor", error);

  return new Map((data ?? []).map((row) => [row.property_id, row]));
}

/**
 * Candidate duplicate pairs (0021).
 *
 * Flagged, never merged. Two genuinely different flats in the same society at
 * the same rent are common, and auto-collapsing them would silently delete a
 * real landlord's listing on a heuristic.
 */
export async function getDuplicateCandidates(
  supabase: SupabaseClient<Database>,
): Promise<DuplicateCandidate[]> {
  const { data, error } = await supabase
    .from("v_possible_duplicates")
    .select("*")
    .order("address_similarity", { ascending: false })
    .limit(50);
  logRead("getDuplicateCandidates", error);

  return data ?? [];
}
