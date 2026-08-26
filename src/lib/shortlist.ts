import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ListingPublic, PropertyUpdate } from "@/types/database";
import { logRead } from "@/lib/errors";

/**
 * Shortlists (0011) — and, more usefully, what has changed since you saved.
 */

export type SavedListing = {
  savedAt: string;
  /** Null when the listing has since been taken down or archived. */
  listing: ListingPublic | null;
  propertyId: string;
  /** Changes logged after the save — the reason to look at this page. */
  changes: PropertyUpdate[];
};

/** Property ids this user has saved, for rendering the toggle in the feed. */
export async function getShortlistIds(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("shortlists")
    .select("property_id")
    .eq("user_id", userId);
  logRead("getShortlistIds", error);

  return new Set((data ?? []).map((r) => r.property_id));
}

export async function isShortlisted(
  supabase: SupabaseClient<Database>,
  userId: string,
  propertyId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("shortlists")
    .select("id")
    .eq("user_id", userId)
    .eq("property_id", propertyId)
    .maybeSingle();
  logRead("isShortlisted", error);

  return Boolean(data);
}

/**
 * The saved listings, each with whatever moved since it was saved.
 *
 * The save timestamp is the watermark: `property_updates` rows newer than it
 * are changes that happened while this person was still deciding. That's the
 * whole point of the page — a bookmark list is only worth opening if it tells
 * you something you didn't already know.
 */
export async function getSavedListings(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<SavedListing[]> {
  const { data: saves } = await supabase
    .from("shortlists")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = saves ?? [];
  if (rows.length === 0) return [];

  return Promise.all(
    rows.map(async (save) => {
      const [{ data: listing }, { data: updates }] = await Promise.all([
        supabase
          .from("v_listings_public")
          .select("*")
          .eq("id", save.property_id)
          .maybeSingle(),
        supabase
          .from("property_updates")
          .select("*")
          .eq("property_id", save.property_id)
          .gte("created_at", save.created_at)
          // A re-verification is the owner saying "still true" — reassurance,
          // not a change to what was offered. Listing it under a warning would
          // make good news read as bad, and the card's freshness badge already
          // says it. Only substantive changes belong here.
          .neq("kind", "verification")
          .order("created_at", { ascending: false }),
      ]);

      return {
        savedAt: save.created_at,
        propertyId: save.property_id,
        listing: listing ?? null,
        changes: updates ?? [],
      };
    }),
  );
}
