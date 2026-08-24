import Link from "next/link";
import { Inbox } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { ListingCard } from "@/components/listings/listing-card";
import { ListingFilterBar } from "@/components/listings/listing-filters";
import { Button } from "@/components/ui/button";
import { getDataClient, getSessionUser } from "@/lib/auth";
import { getShortlistIds } from "@/lib/shortlist";
import { getActiveLocality } from "@/lib/locality";
import { getPublicListings, PAGE_SIZE } from "@/lib/listings";
import { listingFilterSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const raw = await searchParams;
  const filters = listingFilterSchema.parse({
    bhk: raw.bhk ?? "any",
    availability: raw.availability ?? "any",
    // Note: this list is an allow-list, and a filter missing from it fails
    // silently — the schema's `.catch("any")` turns the absent key into "no
    // filter" rather than an error. Adding a control means adding it here too.
    furnishing: raw.furnishing ?? "any",
    occupancy: raw.occupancy ?? "any",
    minBudget: raw.minBudget || undefined,
    maxBudget: raw.maxBudget || undefined,
    freshOnly: raw.freshOnly ?? "",
    sort: raw.sort ?? "verified",
    q: raw.q ?? undefined,
    page: raw.page ?? 1,
  });

  const supabase = await getDataClient();
  const [locality, result, user] = await Promise.all([
    getActiveLocality(supabase),
    getPublicListings(supabase, filters),
    getSessionUser(supabase),
  ]);

  // Only signed-in people get a save affordance, and it costs one extra query
  // for the whole page rather than one per card.
  const savedIds = user ? await getShortlistIds(supabase, user.id) : null;

  const { listings, total, page, pageCount } = result;
  const firstOnPage = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastOnPage = Math.min(page * PAGE_SIZE, total);

  const freshCount = listings.filter((l) => !l.is_stale).length;

  return (
    <div className="min-h-dvh">
      <SiteHeader />

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Rentals in {locality?.name ?? "your locality"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every listing shows when it was last verified, who posted it, and the full cost —
            rent plus everything else.
          </p>
        </div>

        <ListingFilterBar filters={filters} />

        <div className="flex items-baseline justify-between">
          <p className="text-sm text-muted-foreground">
            {total === 0 ? (
              "No listings"
            ) : (
              <>
                Showing{" "}
                <span className="font-medium text-foreground">
                  {firstOnPage}–{lastOnPage}
                </span>{" "}
                of {total} · <span className="font-medium text-foreground">{freshCount}</span>{" "}
                on this page verified recently
              </>
            )}
          </p>
        </div>

        {listings.length === 0 ? (
          <EmptyState hasFilters={hasActiveFilters(filters)} />
        ) : (
          <div className="grid gap-4">
            {listings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                saved={savedIds ? savedIds.has(listing.id) : undefined}
              />
            ))}
          </div>
        )}

        {pageCount > 1 ? (
          <Pager page={page} pageCount={pageCount} params={raw} />
        ) : null}
      </main>
    </div>
  );
}

/**
 * Prev/next links that carry the current filters forward. Plain anchors, not a
 * client component — the feed is a server component and the filters already
 * live in the URL, so paging is just another URL.
 */
function Pager({
  page,
  pageCount,
  params,
}: {
  page: number;
  pageCount: number;
  params: Record<string, string | string[] | undefined>;
}) {
  const href = (n: number) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key === "page" || value === undefined) continue;
      next.set(key, Array.isArray(value) ? (value[0] ?? "") : value);
    }
    if (n > 1) next.set("page", String(n));
    const qs = next.toString();
    return qs ? `/listings?${qs}` : "/listings";
  };

  return (
    <nav className="flex items-center justify-between gap-4" aria-label="Pagination">
      {page > 1 ? (
        <Button asChild variant="outline" size="sm">
          <Link href={href(page - 1)} rel="prev">
            ← Previous
          </Link>
        </Button>
      ) : (
        <span />
      )}

      <span className="text-sm text-muted-foreground">
        Page {page} of {pageCount}
      </span>

      {page < pageCount ? (
        <Button asChild variant="outline" size="sm">
          <Link href={href(page + 1)} rel="next">
            Next →
          </Link>
        </Button>
      ) : (
        <span />
      )}
    </nav>
  );
}

function hasActiveFilters(f: ReturnType<typeof listingFilterSchema.parse>) {
  return (
    f.bhk !== "any" ||
    f.availability !== "any" ||
    f.furnishing !== "any" ||
    f.occupancy !== "any" ||
    f.freshOnly ||
    Boolean(f.q) ||
    typeof f.minBudget === "number" ||
    typeof f.maxBudget === "number"
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="rounded-xl border border-dashed p-10 text-center">
      <Inbox className="mx-auto size-8 text-muted-foreground" />
      <h2 className="mt-3 font-semibold">
        {hasFilters ? "No listings match these filters" : "No live listings yet"}
      </h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        {hasFilters
          ? "Try widening your budget or clearing a filter."
          : "Listings appear here once an owner or broker posts one and it passes review. We'd rather show nothing than show something stale."}
      </p>
      <div className="mt-4 flex justify-center gap-2">
        {hasFilters ? (
          <Button asChild variant="outline" size="sm">
            <Link href="/listings">Clear filters</Link>
          </Button>
        ) : null}
        <Button asChild size="sm" variant={hasFilters ? "ghost" : "default"}>
          <Link href="/listings/new">Post a property</Link>
        </Button>
      </div>
    </div>
  );
}
