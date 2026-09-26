import Link from "next/link";
import { format } from "date-fns";
import { AlertTriangle, Camera, ImageOff, MapPin } from "lucide-react";
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
  const claim = brokerageClaim(listing);

  return (
    <div className="group relative h-full">
      {saved === undefined ? null : (
        <div className="absolute right-2.5 top-2.5 z-20">
          <SaveButton propertyId={listing.id} saved={saved} />
        </div>
      )}

      <Link
        href={`/listings/${listing.id}`}
        className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/80 bg-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-[0_12px_32px_rgba(15,23,42,0.08),0_0_20px_-4px_hsl(var(--primary)/0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        {/* Photo is the hook — big, with the price and freshness read straight off it. */}
        <div className="relative aspect-[16/9] sm:aspect-[4/3] overflow-hidden bg-muted">
          {listing.cover_photo_path ? (
            /* Storage host + fixture data: URLs both defeat next/image. */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl(listing.cover_photo_thumb_path ?? listing.cover_photo_path)}
              alt=""
              loading="lazy"
              className="size-full object-cover transition duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground/50">
              <ImageOff className="size-7" />
              <span className="text-xs">No photo yet</span>
            </div>
          )}

          {/* Scrim so white text and the price sit legibly over any photo. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

          <div className="absolute left-2.5 top-2.5">
            <FreshnessBadge
              daysSinceVerified={listing.days_since_verified}
              isStale={listing.is_stale}
              className="shadow-sm text-[11px] py-0.5 px-2"
            />
          </div>

          <div className="absolute inset-x-3 bottom-2.5 flex items-end justify-between gap-2">
            <div className="text-white drop-shadow-sm">
              <span className="text-lg sm:text-xl font-bold tabular-nums tracking-tight">
                {formatINR(listing.all_in_monthly)}
              </span>
              <span className="text-xs sm:text-sm font-medium text-white/85">/mo</span>
            </div>
            {listing.cover_photo_path ? (
              <span className="flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
                <Camera className="size-3" />
                {listing.rooms_covered}/{listing.rooms_required}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-1 flex-col p-3.5 sm:p-4">
          <h2 className="truncate font-bold text-base sm:text-lg leading-snug tracking-tight text-foreground group-hover:text-primary transition-colors">{listing.title}</h2>

          <p className="mt-1 text-[13px] text-muted-foreground">
            {labelFor(BHK_OPTIONS, listing.bhk)} · {labelFor(FURNISHING_OPTIONS, listing.furnishing)}
            <span className="text-muted-foreground/70"> · {formatINR(listing.move_in_cost)} to move in</span>
          </p>

          {listing.area_name || listing.address_line ? (
            <p className="mt-2 flex items-center gap-1.5 text-[13px] text-muted-foreground">
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

          {/* Trust signals — calm row, the ones a tenant should weigh at a glance. */}
          <div className="mt-3.5 flex flex-wrap items-center gap-1.5 border-t border-border/70 pt-3">
            <Badge variant={listing.availability === "available" ? "secondary" : "outline"}>
              {labelFor(AVAILABILITY_OPTIONS, listing.availability)}
            </Badge>
            <PostedByBadge
              role={listing.posted_by_role}
              sourcedBrokerName={listing.sourced_broker_name}
            />
            {listing.posted_by_role === "broker" && claim === "charged" ? (
              <Badge variant="outline" className="text-foreground border-border/80">
                Brokerage: {formatINR(listing.brokerage)}
              </Badge>
            ) : null}
            {claim === "none" ? (
              <Badge variant="outline" className="text-success border-success/30 bg-success/5 font-medium">
                No brokerage
              </Badge>
            ) : null}
            {listing.posted_by_role === "broker" && claim === "unstated" ? (
              <Badge variant="outline" className="gap-1 text-warning border-warning/30 bg-warning/5">
                <AlertTriangle className="size-3.5" />
                Brokerage not stated
              </Badge>
            ) : null}
            {listing.has_warning ? (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="size-3.5" />
                {listing.open_mismatch_count} mismatch{listing.open_mismatch_count === 1 ? "" : "es"}
              </Badge>
            ) : null}
            {photoWarning?.stale ? (
              <Badge variant="outline" className="gap-1 text-warning">
                <Camera className="size-3.5" />
                {photoWarning.label}
              </Badge>
            ) : null}
          </div>

          <p className="mt-auto pt-3 text-[11px] uppercase tracking-wide text-muted-foreground/80">
            {/* Past-or-today reads as "now", not a stale date — matches the
                detail page, and keeps sourced listings (available_from = ingest
                day) from advertising a move-in date in the past. */}
            Available{" "}
            {new Date(listing.available_from) <= new Date()
              ? "now"
              : format(new Date(listing.available_from), "d MMM yyyy")}
          </p>
        </div>
      </Link>
    </div>
  );
}
