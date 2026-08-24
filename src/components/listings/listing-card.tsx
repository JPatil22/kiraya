import Link from "next/link";
import { format } from "date-fns";
import { AlertTriangle, Camera, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FreshnessBadge } from "./freshness-badge";
import { PostedByBadge } from "./posted-by-badge";
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
    <div className="relative">
      {saved === undefined ? null : (
        <SaveButton propertyId={listing.id} saved={saved} />
      )}

    <Link
      href={`/listings/${listing.id}`}
      className="group block overflow-hidden rounded-xl border bg-card shadow-sm transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      {listing.cover_photo_path ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element -- runtime Storage
              host and fixture data: URLs both defeat next/image. */}
          <img
            src={photoUrl(listing.cover_photo_path)}
            alt=""
            loading="lazy"
            className="aspect-[16/9] w-full bg-muted object-cover sm:aspect-[21/9]"
          />
          <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-background/90 px-1.5 py-0.5 text-xs">
            <Camera className="size-3" />
            {listing.rooms_covered}/{listing.rooms_required} rooms
          </span>
        </div>
      ) : null}

      <div className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-semibold group-hover:underline">{listing.title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {labelFor(BHK_OPTIONS, listing.bhk)} ·{" "}
            {labelFor(FURNISHING_OPTIONS, listing.furnishing)}
          </p>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold tabular-nums">
            {formatINR(listing.all_in_monthly)}
            <span className="text-sm font-normal text-muted-foreground">/mo</span>
          </div>
          <div className="text-xs text-muted-foreground">
            all-in · {formatINR(listing.move_in_cost)} to move in
          </div>
        </div>
      </div>

      {listing.address_line ? (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">{listing.address_line}</span>
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <FreshnessBadge
          daysSinceVerified={listing.days_since_verified}
          isStale={listing.is_stale}
        />
        <Badge variant={listing.availability === "available" ? "secondary" : "outline"}>
          {labelFor(AVAILABILITY_OPTIONS, listing.availability)}
        </Badge>
        <PostedByBadge role={listing.posted_by_role} />
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

      <p className="mt-3 text-xs text-muted-foreground">
        Available from {format(new Date(listing.available_from), "d MMM yyyy")}
      </p>
      </div>
    </Link>
    </div>
  );
}
