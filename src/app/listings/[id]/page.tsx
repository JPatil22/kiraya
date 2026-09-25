import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CalendarDays,
  Camera,
  FileText,
  Flag,
  History,
  Info,
  KeyRound,
  MapPin,
  Pencil,
  ReceiptText,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { CostBreakdown } from "@/components/listings/cost-breakdown";
import { LocationMap } from "@/components/map/location-map";
import { VisitRecord } from "@/components/listings/visit-record";
import { DepositContext } from "@/components/listings/deposit-context";
import { toCoords } from "@/lib/geo";
import { FormattedDescription } from "@/components/listings/formatted-description";
import { FreshnessBadge } from "@/components/listings/freshness-badge";
import { PostedByBadge } from "@/components/listings/posted-by-badge";
import { CountUp } from "@/components/count-up";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IconTile } from "@/components/ui/icon-tile";
import { formatINR } from "@/lib/utils";
import { getDataClient, getSessionUser } from "@/lib/auth";
import { getPublicListing } from "@/lib/listings";
import { getMyOpenReport, getPropertyUpdates } from "@/lib/history";
import { getCounterparty, getMyExchange } from "@/lib/contact";
import { getListingContact } from "@/lib/listing-source";
import { isShortlisted } from "@/lib/shortlist";
import { ASK_AFTER_DAYS, getMyFeedback, getPublicAccuracy } from "@/lib/visits";
import { getVisitForListing, isVisitDone } from "@/lib/visit-scheduling";
import { VisitScheduler } from "@/components/visits/visit-scheduler";
import { getDepositContext, getPriceContext } from "@/lib/insights";
import { getReportsForProperty } from "@/lib/history";
import { OwnerReply } from "./owner-reply";
import { PriceContext } from "@/components/listings/price-context";
import { VisitAsk } from "@/components/visits/visit-ask";
import { getPhotos } from "@/lib/photos";
import { UpdateTimeline } from "@/components/listings/update-timeline";
import { PhotoGallery } from "@/components/listings/photo-gallery";
import { ReportMismatch } from "./report-mismatch";
import { OwnerControls } from "./owner-controls";
import { ContactOwner } from "./contact-owner";
import { SaveButton } from "@/components/listings/save-button";
import { AdminListingBar } from "@/components/admin/admin-listing-bar";
import {
  AVAILABILITY_OPTIONS,
  BHK_OPTIONS,
  FURNISHING_OPTIONS,
  MISMATCH_OPTIONS,
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

  // Postgres numerics arrive as strings through PostgREST often enough to matter.
  const coords = toCoords(listing.latitude, listing.longitude);

  // One round trip, not four. `getMyOpenReport` needs the user id, so it's
  // resolved off getSessionUser rather than after the whole batch.
  const [updates, photos, priceContext, depositContext, accuracy, reports, userWithReport] =
    await Promise.all([
    getPropertyUpdates(supabase, id),
    getPhotos(supabase, id),
    getPriceContext(supabase, id),
    getDepositContext(supabase, id),
    getPublicAccuracy(supabase, id),
    getReportsForProperty(supabase, id),
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
  const isAdmin = user?.role === "admin";

  // The number is only fetched once an exchange exists — 0010's policy is what
  // makes the row readable at all, so this returns null rather than leaking.
  const poster = exchange ? await getCounterparty(supabase, listing.posted_by) : null;

  // A listing seeded from an outside source (e.g. a Facebook post) reveals that
  // real broker's number rather than the seeded identity that posted the row.
  // Same unlock gate as the poster number above, so it can't leak before then.
  const sourceContact = exchange ? await getListingContact(supabase, listing.id) : null;

  // Was this listing sourced from an outside post at all? Its poster is a
  // placeholder identity, so a sourced listing must never reveal that
  // placeholder's number — only the real number scraped from the post, or none.
  // Via the SECURITY DEFINER function (0038) so it works under RLS too: a plain
  // `listing_sources` read is poster/admin-only and would be blocked for a tenant.
  const { data: sourcedFlag } = await (
    supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: boolean | null }>
  )("listing_is_sourced", { p_property: id });
  const isSourced = Boolean(sourcedFlag);

  // Already answered? Then don't ask again on this page.
  const [myFeedback, visit] = exchange && user
    ? await Promise.all([
        getMyFeedback(supabase, user.id, listing.id),
        getVisitForListing(supabase, user.id, listing.id),
      ])
    : [null, null];

  // A confirmed visit whose time has passed is a far better prompt than "you
  // asked for a number three days ago" — it knows a viewing actually happened.
  const askAboutVisit =
    Boolean(exchange) &&
    !myFeedback &&
    (isVisitDone(visit) ||
      Date.parse(exchange!.created_at) <= Date.now() - ASK_AFTER_DAYS * 86_400_000);

  // Posting your own listing doesn't entitle you to report it.
  const canReport = Boolean(user) && !isOwnListing;

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      {/* Background ambient lighting with fluid auroras */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-dot-grid opacity-55 dark:opacity-35 [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,#000_65%,transparent_100%)]"
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-aurora absolute -top-40 left-1/2 h-[520px] w-[920px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,hsl(var(--primary)/0.16),transparent)] blur-3xl" />
        <div className="animate-aurora absolute -top-24 left-[10%] h-[360px] w-[460px] rounded-full bg-[radial-gradient(closest-side,hsl(270_85%_65%/0.11),transparent)] blur-3xl [animation-delay:-7s]" />
        <div className="animate-aurora absolute -top-20 right-[8%] h-[340px] w-[440px] rounded-full bg-[radial-gradient(closest-side,hsl(165_80%_45%/0.09),transparent)] blur-3xl [animation-delay:-12s]" />
      </div>

      <SiteHeader />

      <main className="relative mx-auto max-w-6xl space-y-6 px-6 py-8">
        {/* Top Navigation / Breadcrumb */}
        <div className="animate-fade-up flex items-center justify-between">
          <Button asChild variant="ghost" size="sm" className="-ml-3 hover:bg-primary/5">
            <Link href="/listings" className="gap-1.5 font-medium">
              <ArrowLeft className="size-4" /> All listings
            </Link>
          </Button>
          {user ? <SaveButton propertyId={listing.id} saved={saved} variant="inline" /> : null}
        </div>

        {/* Admin Moderation Bar */}
        {isAdmin ? (
          <div className="animate-fade-up" style={{ animationDelay: "30ms" }}>
            <AdminListingBar
              propertyId={listing.id}
              photoCount={photos.length}
              roomsCovered={listing.rooms_covered}
              roomsRequired={listing.rooms_required}
              isStale={listing.is_stale}
            />
          </div>
        ) : null}

        {/* Listing Header */}
        <div className="animate-fade-up" style={{ animationDelay: "60ms" }}>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <div className="inline-flex items-center">
              <span className="relative flex size-2 mr-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              <FreshnessBadge
                daysSinceVerified={listing.days_since_verified}
                isStale={listing.is_stale}
              />
            </div>
            <Badge variant={listing.availability === "available" ? "secondary" : "outline"}>
              {labelFor(AVAILABILITY_OPTIONS, listing.availability)}
            </Badge>
            <PostedByBadge
              role={listing.posted_by_role}
              name={listing.posted_by_name}
              showName
              sourcedBrokerName={listing.sourced_broker_name}
            />
            {listing.has_warning ? (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="size-3.5" />
                {listing.open_mismatch_count} mismatch{listing.open_mismatch_count === 1 ? "" : "es"}
              </Badge>
            ) : null}
          </div>

          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-4xl text-foreground">
            {listing.title}
          </h1>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{labelFor(BHK_OPTIONS, listing.bhk)}</span>
            <span>·</span>
            <span>{labelFor(FURNISHING_OPTIONS, listing.furnishing)}</span>
            <span>·</span>
            <span>{labelFor(OCCUPANCY_OPTIONS, listing.occupancy_pref)}</span>
            {listing.area_name ? (
              <>
                <span>·</span>
                <span className="flex items-center gap-1 font-medium text-primary">
                  <MapPin className="size-3.5" />
                  {listing.area_name}
                </span>
              </>
            ) : null}
          </div>

          {listing.last_verified_at ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {listing.verified_by_poster
                ? "Confirmed by the person who posted it."
                : "Verified physically by Kiraya."}
            </p>
          ) : null}
        </div>

        {/* Hero Photo Gallery */}
        <div
          className="animate-fade-up overflow-hidden rounded-2xl border border-border/80 bg-card p-1 shadow-sm transition hover:shadow-md"
          style={{ animationDelay: "120ms" }}
        >
          <PhotoGallery
            photos={photos}
            bhk={listing.bhk}
            lastVerifiedAt={listing.last_verified_at}
          />
        </div>

        {/* 2-Column Split: Content on Left, Sticky Action Sidebar on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch pt-2">
          {/* Main Left Column (7 cols) */}
          <div className="lg:col-span-7 space-y-6 animate-fade-up" style={{ animationDelay: "140ms" }}>
            {updated ? (
              <p className="flex items-start gap-2 rounded-xl border border-success/40 bg-success/10 p-3.5 text-sm">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                Saved. The change is on the timeline below, and the listing is stamped as confirmed just now.
              </p>
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

            {/* Owner Management Controls (for owner) */}
            {isOwnListing ? (
              <div className="space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/listings/${listing.id}/photos`}>
                      <Camera className="size-4 mr-1.5" /> Manage photos
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/listings/${listing.id}/edit`}>
                      <Pencil className="size-4 mr-1.5" /> Edit listing
                    </Link>
                  </Button>
                </div>

                <OwnerControls
                  propertyId={listing.id}
                  availability={listing.availability}
                  daysSinceVerified={listing.days_since_verified}
                  isStale={listing.is_stale}
                />

                {reports.length > 0 ? (
                  <Card className="border-destructive/40">
                    <CardHeader>
                      <CardTitle className="text-base">
                        {reports.length} open{" "}
                        {reports.length === 1 ? "report" : "reports"} about this listing
                      </CardTitle>
                      <CardDescription>
                        Your reply goes to the admin reviewing it, and sits next to the report.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {reports.map((r) => (
                        <div key={r.id} className="rounded-lg border p-3">
                          <p className="text-sm font-medium">
                            {labelFor(MISMATCH_OPTIONS, r.type)}
                          </p>
                          {r.description ? (
                            <p className="mt-0.5 text-sm text-muted-foreground">
                              &ldquo;{r.description}&rdquo;
                            </p>
                          ) : null}
                          <OwnerReply reportId={r.id} existing={r.owner_response} />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            ) : null}

            {/* Admin Management Tools (when admin views non-owned listing) */}
            {isAdmin && !isOwnListing ? (
              <div className="space-y-3 rounded-xl border border-border/80 bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Admin Tools
                  </p>
                  <Link
                    href="/admin/listings"
                    className="text-xs text-primary hover:underline"
                  >
                    All listings →
                  </Link>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/listings/${listing.id}/photos`}>
                      <Camera className="size-4 mr-1.5" /> Manage photos
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/listings/${listing.id}/edit`}>
                      <Pencil className="size-4 mr-1.5" /> Edit listing
                    </Link>
                  </Button>
                </div>
              </div>
            ) : null}

            {/* Cost Itemization Card */}
            <Card className="glass-card shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <IconTile icon={ReceiptText} />
                  <CardTitle>What it actually costs</CardTitle>
                </div>
                <CardDescription>
                  Every component, itemised. No &ldquo;brokerage negotiable&rdquo; surprises on site.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <CostBreakdown costs={listing} />
                {accuracy ? <VisitRecord accuracy={accuracy} /> : null}

                {depositContext ? (
                  <DepositContext
                    context={depositContext}
                    bhkLabel={labelFor(BHK_OPTIONS, listing.bhk)}
                    localityName={listing.area_name ?? "this part of the city"}
                  />
                ) : null}

                {priceContext ? (
                  <PriceContext
                    context={priceContext}
                    bhkLabel={labelFor(BHK_OPTIONS, listing.bhk)}
                    localityName={listing.area_name ?? "this part of the city"}
                  />
                ) : null}
              </CardContent>
            </Card>

            {/* Unified Property Overview & Locality Card */}
            <Card className="glass-card shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <IconTile icon={Info} />
                  <CardTitle>About this flat & neighborhood</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Key Attributes Pills */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Availability
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <CalendarDays className="size-4 text-primary" />
                      {new Date(listing.available_from) <= new Date()
                        ? "Available now"
                        : format(new Date(listing.available_from), "d MMM yyyy")}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Furnishing
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {labelFor(FURNISHING_OPTIONS, listing.furnishing)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Tenant Pref
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {labelFor(OCCUPANCY_OPTIONS, listing.occupancy_pref)}
                    </p>
                  </div>
                </div>

                {/* Address & Locality */}
                {listing.address_line || listing.area_name ? (
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 flex items-start gap-2.5 text-sm">
                    <MapPin className="size-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-foreground">
                        {listing.area_name ?? "Locality"}
                      </p>
                      {listing.address_line ? (
                        <p className="text-muted-foreground text-xs mt-0.5">
                          {listing.address_line}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {/* Map View if coords available */}
                {coords ? (
                  <div className="overflow-hidden rounded-xl border border-border/70">
                    <LocationMap latitude={coords.lat} longitude={coords.lng} title={listing.title} />
                  </div>
                ) : listing.sourced_broker_name ? (
                  <p className="text-xs text-muted-foreground bg-muted/20 p-3 rounded-lg border border-border/50">
                    {listing.area_name
                      ? `No exact GPS pin — the verified area is ${listing.area_name}. Confirm exact landmark with the contact.`
                      : "Confirm exact landmark with the contact."}
                  </p>
                ) : null}

                {!listing.description ? (
                  <p className="border-t border-border/60 pt-3 text-xs text-muted-foreground flex items-center gap-2">
                    <CalendarDays className="size-3.5 text-muted-foreground/70" />
                    Listed on {format(new Date(listing.created_at), "d MMM yyyy")}
                    {listing.last_verified_at
                      ? ` · last verified ${format(new Date(listing.last_verified_at), "d MMM yyyy")}`
                      : " · never verified"}
                  </p>
                ) : null}
              </CardContent>
            </Card>

            {/* Description & Notes Card */}
            {listing.description ? (
              <Card className="glass-card shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <IconTile icon={FileText} />
                      <CardTitle>Description & notes</CardTitle>
                    </div>
                    {listing.sourced_broker_name ? (
                      <Badge variant="outline" className="text-xs font-normal text-muted-foreground border-border/70">
                        Curated post
                      </Badge>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormattedDescription text={listing.description} />

                  <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="size-3.5 text-muted-foreground/70" />
                      <span>Listed on {format(new Date(listing.created_at), "d MMM yyyy")}</span>
                      <span>·</span>
                      {listing.last_verified_at ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="size-3" />
                          Last verified {format(new Date(listing.last_verified_at), "d MMM yyyy")}
                        </span>
                      ) : (
                        <span>Never verified</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {/* Public Timeline */}
            <Card className="glass-card shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <IconTile icon={History} />
                  <CardTitle>Update history</CardTitle>
                </div>
                <CardDescription>
                  Recorded automatically by the database on every change — not editable by whoever posted this.
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
          </div>

          {/* Right Sticky Sidebar (5 cols) - stretches full height so sticky never breaks */}
          <div className="lg:col-span-5 relative">
            <div className="sticky top-24 space-y-5">
              {/* Pricing & Primary Action Card */}
              <div className="glass-card rounded-2xl border border-primary/25 p-6 shadow-xl shadow-primary/5 hover:border-primary/40 transition-all duration-300 space-y-5">
                <div className="flex items-baseline justify-between border-b border-border/60 pb-4">
                  <div>
                    <CountUp
                      to={listing.all_in_monthly}
                      prefix="₹"
                      className="text-3xl font-extrabold tabular-nums tracking-tight text-foreground"
                    />
                    <span className="text-sm font-medium text-muted-foreground"> /month</span>
                  </div>
                  <Badge variant="outline" className="font-semibold text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                    All-in cost
                  </Badge>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Move-in total</span>
                    <CountUp to={listing.move_in_cost} prefix="₹" className="font-semibold text-foreground" />
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Flat rent</span>
                    <span className="font-medium text-foreground">{formatINR(listing.rent)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Maintenance</span>
                    <span className="font-medium text-foreground">{formatINR(listing.maintenance_monthly)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Security deposit</span>
                    <span className="font-medium text-foreground">{formatINR(listing.deposit)}</span>
                  </div>
                </div>

                {/* Direct Contact Owner or Unlock */}
                {user && !isOwnListing && listing.availability !== "rented" ? (
                  <div className="pt-2 border-t border-border/60">
                    <ContactOwner
                      propertyId={listing.id}
                      posterName={listing.posted_by_name}
                      posterRole={listing.posted_by_role}
                      unlocked={Boolean(exchange)}
                      phone={
                        isSourced
                          ? sourceContact?.phone ?? null
                          : sourceContact?.phone ?? poster?.phone ?? null
                      }
                      contactName={sourceContact?.name ?? null}
                      sourcedBrokerName={listing.sourced_broker_name}
                      isSourced={isSourced}
                    />
                  </div>
                ) : !user ? (
                  <div className="pt-2 border-t border-border/60">
                    <Button asChild className="w-full h-11 font-semibold shadow-sm">
                      <Link href="/login">Sign in to unlock phone number</Link>
                    </Button>
                  </div>
                ) : null}

                {/* Visit Scheduler in Sidebar */}
                {exchange && user && !isOwnListing && listing.availability !== "rented" ? (
                  <div className="pt-2 border-t border-border/60">
                    <VisitScheduler
                      contactExchangeId={exchange.id}
                      visit={visit}
                      viewerId={user.id}
                    />
                  </div>
                ) : null}

                {askAboutVisit && exchange ? (
                  <div className="pt-2 border-t border-border/60">
                    <VisitAsk contactExchangeId={exchange.id} propertyTitle={listing.title} />
                  </div>
                ) : null}

                {/* Trust Guarantees */}
                <div className="rounded-xl bg-muted/40 p-3.5 text-xs text-muted-foreground space-y-1.5 border border-border/40">
                  <div className="flex items-center gap-2 font-medium text-foreground">
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                    <span>Truth guarantees on this flat:</span>
                  </div>
                  <p>• Verified phone-identity counterparty</p>
                  <p>• Zero undisclosed move-in or broker fees</p>
                  <p>• Immutable database price change record</p>
                </div>
              </div>

              {/* Did this listing match reality? in sidebar */}
              {canReport ? (
                <Card id="mismatch-card" className="glass-card shadow-sm border-dashed scroll-mt-24">
                  <CardHeader className="py-4 px-5">
                    <div className="flex items-center gap-2">
                      <IconTile icon={Flag} className="size-8" />
                      <div>
                        <CardTitle className="text-sm font-semibold">Did this listing match reality?</CardTitle>
                        <CardDescription className="text-xs">
                          Report price or availability discrepancies to help fellow tenants.
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 px-5 pb-4">
                    <ReportMismatch
                      propertyId={listing.id}
                      alreadyReported={Boolean(existingReport)}
                    />
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
