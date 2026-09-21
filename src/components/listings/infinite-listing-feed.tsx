"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { ListingCard } from "./listing-card";
import { Button } from "@/components/ui/button";
import { fetchMoreListings } from "@/app/listings/actions";
import type { ListingFilters } from "@/lib/validators";
import type { ListingPublic } from "@/types/database";

interface InfiniteListingFeedProps {
  initialListings: ListingPublic[];
  total: number;
  pageCount: number;
  filters: ListingFilters;
  savedListingIds?: string[] | null;
  localityName?: string;
}

export function InfiniteListingFeed({
  initialListings,
  total,
  pageCount,
  filters,
  savedListingIds,
  localityName,
}: InfiniteListingFeedProps) {
  const [listings, setListings] = useState<ListingPublic[]>(initialListings);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(pageCount > 1);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Sync state when initialListings or filters change from server re-render
  useEffect(() => {
    setListings(initialListings);
    setPage(1);
    setHasMore(pageCount > 1);
    setError(null);
  }, [initialListings, pageCount, filters]);

  const savedSet = savedListingIds ? new Set(savedListingIds) : null;

  const loadNextPage = () => {
    if (isPending || !hasMore) return;

    startTransition(async () => {
      try {
        setError(null);
        const nextPage = page + 1;
        const result = await fetchMoreListings(filters, nextPage);

        setListings((prev) => {
          const existingIds = new Set(prev.map((l) => l.id));
          const fresh = result.listings.filter((l) => !existingIds.has(l.id));
          return [...prev, ...fresh];
        });
        setPage(nextPage);
        setHasMore(result.hasMore);
      } catch (err) {
        console.error("Failed to load more listings:", err);
        setError("Failed to load more listings. Please try again.");
      }
    });
  };

  // IntersectionObserver for seamless automatic lazy-loading on scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || isPending) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting) {
          loadNextPage();
        }
      },
      {
        rootMargin: "300px", // Pre-fetch before user hits the very bottom
        threshold: 0.1,
      },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isPending, page, filters]);

  return (
    <div className="space-y-8">
      {/* Dynamic Count Subtitle */}
      <div className="flex items-baseline justify-between text-sm text-muted-foreground">
        <p>
          Showing{" "}
          <span className="font-semibold text-foreground">
            {listings.length}
          </span>{" "}
          of{" "}
          <span className="font-semibold text-foreground">
            {total}
          </span>{" "}
          verified {total === 1 ? "flat" : "flats"}
          {localityName ? ` in ${localityName}` : ""}
        </p>

        {hasMore ? (
          <span className="text-xs text-muted-foreground/70 hidden sm:inline-block">
            Scroll down to load more
          </span>
        ) : null}
      </div>

      {/* Grid of Listings */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            saved={savedSet ? savedSet.has(listing.id) : undefined}
          />
        ))}
      </div>

      {/* Lazy Loading Sentinel & Status Footer */}
      <div ref={sentinelRef} className="pt-2">
        {isPending ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-sm text-muted-foreground">
            <Loader2 className="size-6 animate-spin text-primary" />
            <p className="font-medium">Loading more verified flats...</p>
          </div>
        ) : hasMore ? (
          <div className="flex justify-center py-6">
            <Button
              variant="outline"
              size="sm"
              onClick={loadNextPage}
              className="gap-2 text-xs font-medium border-border/80 hover:bg-muted"
            >
              <Sparkles className="size-3.5 text-primary" />
              Load more listings ({listings.length} of {total} shown)
            </Button>
          </div>
        ) : listings.length > 0 ? (
          <div className="flex flex-col items-center justify-center gap-1.5 py-10 text-center text-sm text-muted-foreground border-t border-border/40">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <CheckCircle2 className="size-4 text-emerald-500" />
              You&apos;ve viewed all {total} verified {total === 1 ? "listing" : "listings"}
            </div>
            <p className="text-xs text-muted-foreground/80">
              Only fresh, physically verified flats are listed on Kiraya.
            </p>
          </div>
        ) : null}

        {error ? (
          <div className="flex flex-col items-center justify-center gap-2 py-4 text-center">
            <p className="text-xs font-medium text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={loadNextPage} className="text-xs">
              Retry loading
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
