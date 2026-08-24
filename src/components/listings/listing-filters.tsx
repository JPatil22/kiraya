import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AVAILABILITY_OPTIONS,
  BHK_OPTIONS,
  FURNISHING_OPTIONS,
  OCCUPANCY_OPTIONS,
  SORT_OPTIONS,
} from "@/lib/constants";
import type { ListingFilters } from "@/lib/validators";
import { cn } from "@/lib/utils";

const selectClass =
  "flex h-9 w-full items-center rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

/**
 * Plain GET form — filters live in the URL, so the feed stays a server
 * component, results are shareable, and back/forward just works.
 */
export function ListingFilterBar({ filters }: { filters: ListingFilters }) {
  return (
    <form method="get" action="/listings" className="rounded-xl border bg-card p-4">
      <div className="mb-4 space-y-1.5">
        <Label htmlFor="q">Search</Label>
        <Input
          id="q"
          name="q"
          type="search"
          placeholder="Area, landmark or anything in the listing — e.g. Baner, Kothrud, parking"
          defaultValue={filters.q ?? ""}
          maxLength={80}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="bhk">Configuration</Label>
          <select id="bhk" name="bhk" defaultValue={filters.bhk} className={selectClass}>
            <option value="any">Any</option>
            {BHK_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="minBudget">Min ₹/mo (all-in)</Label>
          <Input
            id="minBudget"
            name="minBudget"
            type="number"
            inputMode="numeric"
            min={0}
            step={500}
            placeholder="Any"
            defaultValue={filters.minBudget ?? ""}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="maxBudget">Max ₹/mo (all-in)</Label>
          <Input
            id="maxBudget"
            name="maxBudget"
            type="number"
            inputMode="numeric"
            min={0}
            step={500}
            placeholder="Any"
            defaultValue={filters.maxBudget ?? ""}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="availability">Availability</Label>
          <select
            id="availability"
            name="availability"
            defaultValue={filters.availability}
            className={selectClass}
          >
            <option value="any">Any</option>
            {AVAILABILITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="furnishing">Furnishing</Label>
          <select
            id="furnishing"
            name="furnishing"
            defaultValue={filters.furnishing}
            className={selectClass}
          >
            <option value="any">Any</option>
            {FURNISHING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="occupancy">Who&apos;s moving in</Label>
          <select
            id="occupancy"
            name="occupancy"
            defaultValue={filters.occupancy}
            className={selectClass}
          >
            <option value="any">Anyone</option>
            {OCCUPANCY_OPTIONS.filter((o) => o.value !== "any").map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sort">Sort by</Label>
          <select id="sort" name="sort" defaultValue={filters.sort} className={selectClass}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="freshOnly"
            value="1"
            defaultChecked={filters.freshOnly}
            className={cn(
              "size-4 rounded border-input accent-primary",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            )}
          />
          Hide stale listings
        </label>
        <Button type="submit" size="sm">
          <Search /> Apply filters
        </Button>
      </div>
    </form>
  );
}
