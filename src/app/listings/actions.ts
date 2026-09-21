"use server";

import { getDataClient } from "@/lib/auth";
import { getCachedPublicListings } from "@/lib/listings";
import type { ListingFilters } from "@/lib/validators";
import type { ListingPublic } from "@/types/database";

export async function fetchMoreListings(
  filters: ListingFilters,
  page: number,
): Promise<{ listings: ListingPublic[]; hasMore: boolean; page: number }> {
  const supabase = await getDataClient();
  const result = await getCachedPublicListings(supabase, { ...filters, page });
  return {
    listings: result.listings,
    hasMore: page < result.pageCount,
    page: result.page,
  };
}
