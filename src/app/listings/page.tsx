import Link from "next/link";
import { Inbox } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { ListingCard } from "@/components/listings/listing-card";
import { ListingFilterBar } from "@/components/listings/listing-filters";
import { Button } from "@/components/ui/button";
import { getDataClient } from "@/lib/auth";
import { getActiveLocality } from "@/lib/locality";
import { getPublicListings } from "@/lib/listings";
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
  });

  const supabase = await getDataClient();
  const [locality, listings] = await Promise.all([
    getActiveLocality(supabase),
    getPublicListings(supabase, filters),
  ]);

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
            {listings.length} listing{listings.length === 1 ? "" : "s"}
            {listings.length > 0 ? (
              <>
                {" "}
                · <span className="font-medium text-foreground">{freshCount}</span> verified
                recently
              </>
            ) : null}
          </p>
        </div>

        {listings.length === 0 ? (
          <EmptyState hasFilters={hasActiveFilters(filters)} />
        ) : (
          <div className="grid gap-4">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function hasActiveFilters(f: ReturnType<typeof listingFilterSchema.parse>) {
  return (
    f.bhk !== "any" ||
    f.availability !== "any" ||
    f.freshOnly ||
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
