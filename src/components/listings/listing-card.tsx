import Link from "next/link";
import { format } from "date-fns";
import { AlertTriangle, Camera, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FreshnessBadge } from "./freshness-badge";
import { PostedByBadge } from "./posted-by-badge";
import { brokerageClaim } from "@/lib/brokerage";
import { AVAILABILITY_OPTIONS, BHK_OPTIONS, FURNISHING_OPTIONS, labelFor } from "@/lib/constants";
import { photoAgeWarning, photoUrl } from "@/lib/photos";
import { formatINR } from "@/lib/utils";
import { SaveButton } from "./save-button";
import type { ListingPublic } from "@/types/database";

export function ListingCard({
  listing,
  saved,
}: {
  listing: ListingPublic;
  /** Omitted when nobody is signed in — no save affordance for a stranger. */
  saved?: boolean;
}) {
  const photoWarning = listing.cover_photo_path
    ? photoAgeWarning(listing.cover_photo_captured_at, listing.last_verified_at)
    : null;

  return (
    <div className="relative h-full">
      {saved === undefined ? null : (
        <SaveButton propertyId={listing.id} saved={saved} />
      )}

    <Link
      href={`/listings/${listing.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-card transition duration-200 hover:border-foreground/15 hover:shadow-[0_1px_2px_rgba(16,24,40,0.04),0_4px_12px_rgba(16,24,40,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      {listing.cover_photo_path ? (
        <div className="relative overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element -- runtime Storage
              host and fixture data: URLs both defeat next/image. */}
          <img
            src={photoUrl(listing.cover_photo_thumb_path ?? listing.cover_photo_path)}
            alt=""
            loading="lazy"
            className="aspect-[4/3] w-full bg-muted object-cover transition duration-300 group-hover:scale-[1.02]"
          />
          <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground shadow-sm">
            <Camera className="size-3" />
            {listing.rooms_covered}/{listing.rooms_required}
          </span>
        </div>
      ) : null}

      <div className="flex flex-1 flex-col p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-[15px] font-semibold leading-snug tracking-tight">
            {listing.title}
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {labelFor(BHK_OPTIONS, listing.bhk)} ·{" "}
            {labelFor(FURNISHING_OPTIONS, listing.furnishing)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-lg font-semibold tabular-nums tracking-tight">
            {formatINR(listing.all_in_monthly)}
            <span className="text-xs font-normal text-muted-foreground">/mo</span>
          </div>
          <div className="text-[11px] text-muted-foreground">
            {formatINR(listing.move_in_cost)} to move in
          </div>
        </div>
      </div>

      {listing.area_name || listing.address_line ? (
        <p className="mt-2.5 flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">
            {listing.area_name ? (
              <span className="font-medium text-foreground">{listing.area_name}</span>
            ) : null}
            {listing.area_name && listing.address_line ? " · " : null}
            {listing.address_line}
          </span>
        </p>
      ) : null}

      <div className="mt-3.5 flex flex-wrap items-center gap-1.5 border-t border-border/70 pt-3.5">
        <FreshnessBadge
          daysSinceVerified={listing.days_since_verified}
          isStale={listing.is_stale}
        />
        <Badge variant={listing.availability === "available" ? "secondary" : "outline"}>
          {labelFor(AVAILABILITY_OPTIONS, listing.availability)}
        </Badge>
        <PostedByBadge
          role={listing.posted_by_role}
          sourcedBrokerName={listing.sourced_broker_name}
        />
        {/*
          Only worth a chip on a broker's listing (0023). "Owner" already implies
          no fee, and badging every owner listing would bury the signal in noise.
        */}
        {listing.posted_by_role === "broker" && brokerageClaim(listing) === "none" ? (
          <Badge variant="outline" className="gap-1 text-success">
            No brokerage
          </Badge>
        ) : null}
        {brokerageClaim(listing) === "unstated" ? (
          <Badge variant="outline" className="gap-1 text-warning">
            <AlertTriangle className="size-3.5" />
            Brokerage not stated
          </Badge>
        ) : null}
        {listing.has_warning ? (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="size-3.5" />
            {listing.open_mismatch_count} mismatch reports
          </Badge>
        ) : null}
        {photoWarning?.stale ? (
          <Badge variant="outline" className="gap-1 text-warning">
            <Camera className="size-3.5" />
            {photoWarning.label}
          </Badge>
        ) : null}
        {listing.rooms_covered < listing.rooms_required ? (
          <Badge variant="outline" className="gap-1 text-warning">
            <Camera className="size-3.5" />
            {listing.rooms_required - listing.rooms_covered} room
            {listing.rooms_required - listing.rooms_covered === 1 ? "" : "s"} not shown
          </Badge>
        ) : null}
      </div>

      <p className="mt-auto pt-3 text-[11px] uppercase tracking-wide text-muted-foreground/80">
        Available {format(new Date(listing.available_from), "d MMM yyyy")}
      </p>
      </div>
    </Link>
    </div>
  );
}
