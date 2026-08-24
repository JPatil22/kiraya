import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ListingPublic, Property } from "@/types/database";
import type { ListingFilters } from "@/lib/validators";
import { ACTIVE_LOCALITY_SLUG } from "@/lib/locality";

/**
 * Tenant-facing feed. Reads `v_listings_public`, which already restricts to
 * `live` listings and computes all-in cost, freshness and mismatch warnings.
 * Budget filters apply to `all_in_monthly` (rent + maintenance) — the honest
 * number — not to bare rent.
 */
export async function getPublicListings(
  supabase: SupabaseClient<Database>,
  filters: ListingFilters,
): Promise<ListingPublic[]> {
  let query = supabase
    .from("v_listings_public")
    .select("*")
    .eq("locality_slug", ACTIVE_LOCALITY_SLUG);

  if (filters.bhk !== "any") query = query.eq("bhk", filters.bhk);

  // A rented flat is the thing this product exists to stop showing people, so
  // it leaves the feed the moment the owner says so (0009). It's hidden, not
  // deleted: the detail page still resolves, so shared links and the change
  // history survive. Asking for `availability=rented` explicitly still works.
  if (filters.availability !== "any") {
    query = query.eq("availability", filters.availability);
  } else {
    query = query.neq("availability", "rented");
  }
  if (filters.furnishing !== "any") query = query.eq("furnishing", filters.furnishing);

  // Occupancy is the landlord's preference, not a fact about the flat, so a
  // bachelor searching for "bachelors_male" must still see every listing marked
  // open to anyone. Matching on equality alone would have hidden two of the
  // three listings actually available to them.
  if (filters.occupancy !== "any") {
    query = query.in("occupancy_pref", [filters.occupancy, "any"]);
  }

  if (typeof filters.minBudget === "number") {
    query = query.gte("all_in_monthly", filters.minBudget);
  }
  if (typeof filters.maxBudget === "number") {
    query = query.lte("all_in_monthly", filters.maxBudget);
  }
  if (filters.freshOnly) query = query.eq("is_stale", false);

  switch (filters.sort) {
    case "price_asc":
      query = query.order("all_in_monthly", { ascending: true });
      break;
    case "price_desc":
      query = query.order("all_in_monthly", { ascending: false });
      break;
    case "recent":
      query = query.order("created_at", { ascending: false });
      break;
    case "verified":
    default:
      // Freshest verification first; never-verified listings sink to the bottom.
      query = query.order("last_verified_at", { ascending: false, nullsFirst: false });
      break;
  }

  const { data, error } = await query.limit(60);
  if (error) throw error;
  return data ?? [];
}

/** A single live listing for the public detail page. */
export async function getPublicListing(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<ListingPublic | null> {
  const { data } = await supabase
    .from("v_listings_public")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data;
}

/**
 * Listings posted by the current user, in any status. RLS lets a poster read
 * their own rows, so drafts and pending-review items show up here.
 */
export async function getMyListings(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Property[]> {
  const { data } = await supabase
    .from("properties")
    .select("*")
    .eq("posted_by", userId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

/** Human copy for the freshness signal — the core "is this real?" cue. */
export function freshnessLabel(
  daysSinceVerified: number | null,
  isStale: boolean,
): { label: string; tone: "fresh" | "stale" } {
  if (daysSinceVerified === null) return { label: "Never verified", tone: "stale" };

  const when =
    daysSinceVerified <= 0
      ? "today"
      : daysSinceVerified === 1
        ? "yesterday"
        : `${daysSinceVerified} days ago`;

  return isStale
    ? { label: `Last verified ${when}`, tone: "stale" }
    : { label: `Verified ${when}`, tone: "fresh" };
}
