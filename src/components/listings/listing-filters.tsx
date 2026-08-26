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
import { groupByZone } from "@/lib/areas";
import { FieldSelect } from "@/components/ui/field-select";
import type { Area } from "@/types/database";
import { cn } from "@/lib/utils";


/**
 * Plain GET form — filters live in the URL, so the feed stays a server
 * component, results are shareable, and back/forward just works.
 */
export function ListingFilterBar({
  filters,
  areas,
}: {
  filters: ListingFilters;
  areas: Area[];
}) {
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
          <Label htmlFor="area">Area</Label>
          <FieldSelect
            id="area"
            name="area"
            defaultValue={filters.area ?? "any"}
            groups={[
              { group: "All", choices: [{ value: "any", label: "Anywhere in the city" }] },
              ...groupByZone(areas).map(({ zone, areas: inZone }) => ({
                group: zone,
                choices: inZone.map((a) => ({ value: a.slug, label: a.name })),
              })),
            ]}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bhk">Configuration</Label>
          <FieldSelect
            id="bhk"
            name="bhk"
            defaultValue={filters.bhk}
            choices={[{ value: "any", label: "Any" }, ...BHK_OPTIONS.map((o) => ({ value: o.value, label: o.label }))]}
          />
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
          <FieldSelect
            id="availability"
            name="availability"
            defaultValue={filters.availability}
            choices={[{ value: "any", label: "Any" }, ...AVAILABILITY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))]}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="furnishing">Furnishing</Label>
          <FieldSelect
            id="furnishing"
            name="furnishing"
            defaultValue={filters.furnishing}
            choices={[{ value: "any", label: "Any" }, ...FURNISHING_OPTIONS.map((o) => ({ value: o.value, label: o.label }))]}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="occupancy">Who&apos;s moving in</Label>
          <FieldSelect
            id="occupancy"
            name="occupancy"
            defaultValue={filters.occupancy}
            choices={[{ value: "any", label: "Anyone" }]}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sort">Sort by</Label>
          <FieldSelect
            id="sort"
            name="sort"
            defaultValue={filters.sort}
            choices={[...SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))]}
          />
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
