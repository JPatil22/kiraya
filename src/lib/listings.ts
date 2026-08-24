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
/**
 * Make a user's words safe to drop into a PostgREST `or()` filter.
 *
 * `or()` takes a *filter string*, not a bound parameter: commas separate
 * conditions, dots separate column.operator.value, and parens group. A tenant
 * typing "2bhk, baner" would otherwise produce a malformed condition, and a
 * deliberate `)` could reshape the filter entirely. So the characters that
 * carry meaning in that grammar are stripped rather than escaped — nobody
 * searching for a flat needs them, and stripping can't be got wrong the way
 * escaping can.
 */
const SEARCH_COLUMNS = ["title", "description", "address_line"] as const;

function sanitiseSearch(raw: string): string {
  return raw
    .replace(/[,()*%\\"':.]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export const PAGE_SIZE = 20;

export type ListingPage = {
  listings: ListingPublic[];
  /** Total matching the filters, before paging — needed for "1-20 of 47". */
  total: number;
  page: number;
  pageCount: number;
};

export async function getPublicListings(
  supabase: SupabaseClient<Database>,
  filters: ListingFilters,
): Promise<ListingPage> {
  let query = supabase
    .from("v_listings_public")
    // `exact` counts rows matching the filters but before the range, which is
    // the number a person needs: "47 listings" then paged 20 at a time. The
    // feed used to hard-stop at 60 with no indication anything was cut.
    .select("*", { count: "exact" })
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

  // Substring match across the three fields a tenant actually types into: the
  // title, the free-text description, and the street/landmark. Deliberately NOT
  // the poster's name — that's theirs, not a search key.
  //
  // Every word must match SOMETHING, rather than the whole phrase matching one
  // field: "baner parking" should find the Balewadi flat whose address says
  // Baner and whose description mentions parking. Treating the phrase as a
  // single substring returned nothing for any two-word search.
  //
  // Chained `or()` calls AND together in PostgREST, which is exactly the shape
  // that gives: (w1 in any column) AND (w2 in any column).
  const words = filters.q ? sanitiseSearch(filters.q).split(" ").filter(Boolean).slice(0, 6) : [];
  for (const word of words) {
    query = query.or(
      SEARCH_COLUMNS.map((col) => `${col}.ilike.*${word}*`).join(","),
    );
  }

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

  const from = (filters.page - 1) * PAGE_SIZE;
  const { data, error, count } = await query.range(from, from + PAGE_SIZE - 1);

  if (error) {
    // PostgREST refuses a range past the end of the result set rather than
    // returning nothing (PGRST103). A hand-edited or bookmarked `?page=99`
    // would therefore 500 the whole feed. Fall back to the first page, which
    // always exists and comes with a working pager, instead of an error screen.
    if (error.code === "PGRST103" && filters.page > 1) {
      return getPublicListings(supabase, { ...filters, page: 1 });
    }
    throw error;
  }

  const total = count ?? (data ?? []).length;
  return {
    listings: data ?? [],
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
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
