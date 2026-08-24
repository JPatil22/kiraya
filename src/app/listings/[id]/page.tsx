import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CalendarDays,
  Camera,
  History,
  KeyRound,
  MapPin,
  Pencil,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { CostBreakdown } from "@/components/listings/cost-breakdown";
import { FreshnessBadge } from "@/components/listings/freshness-badge";
import { PostedByBadge } from "@/components/listings/posted-by-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDataClient, getSessionUser } from "@/lib/auth";
import { getPublicListing } from "@/lib/listings";
import { getMyOpenReport, getPropertyUpdates } from "@/lib/history";
import { getCounterparty, getMyExchange } from "@/lib/contact";
import { isShortlisted } from "@/lib/shortlist";
import { getPhotos } from "@/lib/photos";
import { UpdateTimeline } from "@/components/listings/update-timeline";
import { PhotoGallery } from "@/components/listings/photo-gallery";
import { ReportMismatch } from "./report-mismatch";
import { OwnerControls } from "./owner-controls";
import { ContactOwner } from "./contact-owner";
import { SaveButton } from "@/components/listings/save-button";
import {
  AVAILABILITY_OPTIONS,
  BHK_OPTIONS,
  FURNISHING_OPTIONS,
  OCCUPANCY_OPTIONS,
  labelFor,
} from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function ListingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ updated?: string }>;
}) {
  const { id } = await params;
  const { updated } = await searchParams;
  const supabase = await getDataClient();
  const listing = await getPublicListing(supabase, id);
  if (!listing) notFound();

  // One round trip, not four. `getMyOpenReport` needs the user id, so it's
  // resolved off getSessionUser rather than after the whole batch.
  const [updates, photos, userWithReport] = await Promise.all([
    getPropertyUpdates(supabase, id),
    getPhotos(supabase, id),
    getSessionUser(supabase).then(async (u) => {
      const isOther = Boolean(u) && u!.id !== listing.posted_by;
      const [report, exchange, saved] = await Promise.all([
        isOther ? getMyOpenReport(supabase, id, u!.id) : null,
        isOther ? getMyExchange(supabase, id, u!.id) : null,
        u ? isShortlisted(supabase, u.id, id) : false,
      ]);
      return { user: u, report, exchange, saved };
    }),
  ]);

  const { user, report: existingReport, exchange, saved } = userWithReport;
  const isOwnListing = user?.id === listing.posted_by;

  // The number is only fetched once an exchange exists — 0010's policy is what
  // makes the row readable at all, so this returns null rather than leaking.
  const poster = exchange ? await getCounterparty(supabase, listing.posted_by) : null;

  // Posting your own listing doesn't entitle you to report it.
  const canReport = Boolean(user) && !isOwnListing;

  return (
    <div className="min-h-dvh">
      <SiteHeader />

      <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/listings">
            <ArrowLeft /> All listings
          </Link>
        </Button>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">{listing.title}</h1>
          <p className="mt-1 text-muted-foreground">
            {labelFor(BHK_OPTIONS, listing.bhk)} ·{" "}
            {labelFor(FURNISHING_OPTIONS, listing.furnishing)} ·{" "}
            {labelFor(OCCUPANCY_OPTIONS, listing.occupancy_pref)}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <FreshnessBadge
              daysSinceVerified={listing.days_since_verified}
              isStale={listing.is_stale}
            />
            <Badge variant={listing.availability === "available" ? "secondary" : "outline"}>
              {labelFor(AVAILABILITY_OPTIONS, listing.availability)}
            </Badge>
            <PostedByBadge
              role={listing.posted_by_role}
              name={listing.posted_by_name}
              showName
            />
            {user ? <SaveButton propertyId={listing.id} saved={saved} variant="inline" /> : null}
          </div>

          {/* Who stamped the freshness clock. An owner's word and a Kiraya
              check are both worth something, but not the same thing — so the
              source is named rather than blurred into one "verified". */}
          {listing.last_verified_at ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {listing.verified_by_poster
                ? "Confirmed by the person who posted it."
                : "Verified by Kiraya."}
            </p>
          ) : null}
        </div>

        {updated ? (
          <p className="flex items-start gap-2 rounded-lg border border-success/40 bg-success/10 p-3 text-sm">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
            Saved. The change is on the timeline below, and the listing is stamped as
            confirmed just now.
          </p>
        ) : null}

        {listing.availability === "rented" ? (
          <div className="flex items-start gap-3 rounded-xl border bg-muted p-4">
            <KeyRound className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium">This one&apos;s gone — the owner marked it rented.</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                It no longer appears in the feed. The page stays up so you can see what it was
                and when it changed.
              </p>
            </div>
          </div>
        ) : null}

        <PhotoGallery
          photos={photos}
          bhk={listing.bhk}
          lastVerifiedAt={listing.last_verified_at}
        />

        {isOwnListing ? (
          <>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/listings/${listing.id}/photos`}>
                  <Camera /> Manage photos
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/listings/${listing.id}/edit`}>
                  <Pencil /> Edit listing
                </Link>
              </Button>
            </div>

            <OwnerControls
              propertyId={listing.id}
              availability={listing.availability}
              daysSinceVerified={listing.days_since_verified}
              isStale={listing.is_stale}
            />
          </>
        ) : null}

        {listing.has_warning ? (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/50 bg-destructive/10 p-4">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-destructive">
                {listing.open_mismatch_count} tenants reported this listing doesn&apos;t match reality
              </p>
              <p className="mt-0.5 text-sm text-destructive/90">
                Confirm the rent and availability before you travel to see it.
              </p>
            </div>
          </div>
        ) : null}

        {listing.is_stale ? (
          <div className="rounded-xl border border-warning/50 bg-warning/10 p-4 text-sm">
            <span className="font-medium">This listing is stale.</span> Nobody has confirmed
            it recently, so the price and availability may have changed.
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>What it actually costs</CardTitle>
            <CardDescription>
              Every component, itemised. No &ldquo;brokerage negotiable&rdquo; surprises on site.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CostBreakdown costs={listing} />
          </CardContent>
        </Card>

        {user && !isOwnListing && listing.availability !== "rented" ? (
          <ContactOwner
            propertyId={listing.id}
            posterName={listing.posted_by_name}
            posterRole={listing.posted_by_role}
            unlocked={Boolean(exchange)}
            phone={poster?.phone ?? null}
          />
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
              Available from{" "}
              <span className="font-medium">
                {format(new Date(listing.available_from), "d MMM yyyy")}
              </span>
            </div>

            {listing.address_line ? (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="size-4 shrink-0 text-muted-foreground" />
                {listing.address_line}
              </div>
            ) : null}

            {listing.description ? (
              <p className="whitespace-pre-line text-sm text-muted-foreground">
                {listing.description}
              </p>
            ) : null}

            <p className="border-t pt-4 text-xs text-muted-foreground">
              Listed on {format(new Date(listing.created_at), "d MMM yyyy")}
              {listing.last_verified_at
                ? ` · last verified ${format(new Date(listing.last_verified_at), "d MMM yyyy")}`
                : " · never verified"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <History className="size-5 text-muted-foreground" />
              <CardTitle>Update history</CardTitle>
            </div>
            <CardDescription>
              Recorded automatically by the database on every change — not editable by
              whoever posted this.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UpdateTimeline
              updates={updates}
              postedBy={listing.posted_by}
              postedByRole={listing.posted_by_role}
            />
          </CardContent>
        </Card>

        {canReport ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Did this listing match reality?</CardTitle>
              <CardDescription>
                If the price, availability or details were different when you called or
                visited, say so — it&apos;s what keeps the rest of the feed honest.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ReportMismatch
                propertyId={listing.id}
                alreadyReported={Boolean(existingReport)}
              />
            </CardContent>
          </Card>
        ) : null}
      </main>
    </div>
  );
}
