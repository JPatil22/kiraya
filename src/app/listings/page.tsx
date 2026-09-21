import Link from "next/link";
import { ArrowRight, Inbox, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { ListingCard } from "@/components/listings/listing-card";
import { ListingFilterBar } from "@/components/listings/listing-filters";
import { Button } from "@/components/ui/button";
import { getDataClient, getSessionUser } from "@/lib/auth";
import { getShortlistIds } from "@/lib/shortlist";
import { getAreas } from "@/lib/areas";
import { getActiveLocality } from "@/lib/locality";
import { getCachedPublicListings, PAGE_SIZE } from "@/lib/listings";
import { listingFilterSchema } from "@/lib/validators";

import { InfiniteListingFeed } from "@/components/listings/infinite-listing-feed";

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
    area: raw.area ?? undefined,
    page: raw.page ?? 1,
  });

  const supabase = await getDataClient();
  const [locality, result, user, areas] = await Promise.all([
    getActiveLocality(supabase),
    getCachedPublicListings(supabase, filters),
    getSessionUser(supabase),
    getAreas(supabase),
  ]);

  // Only signed-in people get a save affordance, and it costs one extra query
  // for the whole page rather than one per card.
  const savedIds = user ? await getShortlistIds(supabase, user.id) : null;

  const { listings, total, pageCount } = result;

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      {/* Background ambient lighting with animated auroras */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-dot-grid opacity-55 dark:opacity-35 [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,#000_65%,transparent_100%)]"
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-aurora absolute -top-40 left-1/2 h-[520px] w-[920px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,hsl(var(--primary)/0.15),transparent)] blur-3xl" />
        <div className="animate-aurora absolute -top-24 left-[12%] h-[360px] w-[460px] rounded-full bg-[radial-gradient(closest-side,hsl(270_85%_65%/0.10),transparent)] blur-3xl [animation-delay:-6s]" />
        <div className="animate-aurora absolute -top-20 right-[10%] h-[340px] w-[420px] rounded-full bg-[radial-gradient(closest-side,hsl(165_80%_45%/0.08),transparent)] blur-3xl [animation-delay:-11s]" />
      </div>

      <SiteHeader />

      <main className="relative mx-auto max-w-6xl space-y-8 px-6 py-10">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary mb-3">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Verified City Feed
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Rentals in {locality?.name ?? "your locality"}
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            Every flat is verified physically, stamped with its last confirmation date, and displays the 100% transparent all-in monthly and move-in cost.
          </p>
        </div>

        {/* Switcher to Kiraya Direct & Flatmates */}
        <Link
          href="/direct"
          className="group flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30 p-4 transition text-left"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-600/20">
              <Sparkles className="size-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-foreground">
                  Looking for ₹0 Brokerage &amp; Corporate Flatmates?
                </span>
                <span className="rounded-full bg-emerald-600/15 border border-emerald-600/30 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                  Strictly ₹0 Brokerage
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Switch to Kiraya Direct — peer-to-peer shared rooms &amp; direct owner flats for verified working professionals only.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform shrink-0">
            Open Kiraya Direct <ArrowRight className="size-3.5" />
          </span>
        </Link>

        <ListingFilterBar filters={filters} areas={areas} />

        {listings.length === 0 ? (
          <EmptyState hasFilters={hasActiveFilters(filters)} />
        ) : (
          <InfiniteListingFeed
            initialListings={listings}
            total={total}
            pageCount={pageCount}
            filters={filters}
            savedListingIds={savedIds ? Array.from(savedIds) : null}
            localityName={locality?.name}
          />
        )}
      </main>
    </div>
  );
}

function hasActiveFilters(f: ReturnType<typeof listingFilterSchema.parse>) {
  return (
    f.bhk !== "any" ||
    Boolean(f.area && f.area !== "any") ||
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
