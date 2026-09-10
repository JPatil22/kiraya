import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { OpenModeSeedHint } from "@/components/open-mode-seed-hint";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListingForm } from "@/components/listings/listing-form";
import { PhotoManager } from "@/app/listings/[id]/photos/photo-manager";
import { requireAdminPage } from "@/lib/admin-guard";
import { getAreas } from "@/lib/areas";
import { getPosterRole } from "@/lib/brokerage";
import { getPhotos } from "@/lib/photos";
import { missingRooms } from "@/lib/rooms";
import { updateListing } from "@/app/listings/[id]/actions";
import { ReviewPageActions } from "./review-actions";

export const dynamic = "force-dynamic";

/**
 * Review a pending listing before it goes public (0037). One page to see the
 * whole thing, fix the parsed fields in place (a scraped listing often lands
 * with a ₹0 rent or no area), tag its source photos to rooms, then approve —
 * which flips it to `live` and stamps it verified. Warnings flag what's rough
 * but never block: the admin is the judge.
 */
export default async function ReviewListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireAdminPage();
  if (!ctx.ok) {
    return (
      <div className="min-h-dvh">
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-6 py-8">
          <OpenModeSeedHint role={ctx.devRole} />
        </main>
      </div>
    );
  }

  const supabase = ctx.supabase;
  const { data: listing } = await supabase
    .from("properties")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!listing) notFound();

  const [areas, photos, source] = await Promise.all([
    getAreas(supabase),
    getPhotos(supabase, id),
    supabase
      .from("listing_sources")
      .select("source_name, source_phone, note")
      .eq("property_id", id)
      .maybeSingle()
      .then((r) => r.data),
  ]);

  const { data: stagedRows } = await supabase
    .from("ingest_photos")
    .select("*")
    .eq("property_id", id)
    .order("created_at", { ascending: true });
  const staged = (stagedRows ?? []).map((r) => ({
    id: r.id,
    storagePath: r.storage_path,
    thumbnailPath: r.thumbnail_path,
  }));

  const posterRole = await getPosterRole(supabase, listing.posted_by);

  // Non-blocking readiness flags — the honest gaps a scraped listing arrives with.
  const warnings: string[] = [];
  if (listing.rent === 0) warnings.push("Rent is ₹0 — set the monthly rent below.");
  if (!listing.area_id) warnings.push("No neighbourhood set — pick one so it shows in the right filters.");
  if (staged.length > 0) {
    warnings.push(`${staged.length} source photo${staged.length === 1 ? "" : "s"} still untagged — tag or discard ${staged.length === 1 ? "it" : "them"}.`);
  }
  const missing = missingRooms(listing.bhk, photos);
  if (missing.length > 0) {
    warnings.push(`${missing.length} required room${missing.length === 1 ? "" : "s"} not photographed: ${missing.map((s) => s.label).join(", ")}.`);
  }

  const statusLabel =
    listing.status === "pending_review"
      ? "Awaiting review"
      : listing.status === "live"
        ? "Live"
        : listing.status;

  return (
    <AdminShell
      active="/admin/listings"
      title="Review listing"
      description="See it as a tenant will, fix anything the parser got wrong, tag the photos, then approve to publish."
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/admin/listings">
            <ArrowLeft /> Back to queue
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant={listing.status === "live" ? "success" : "secondary"}>{statusLabel}</Badge>
          {listing.status === "live" ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/listings/${id}`}>
                View public page <ExternalLink />
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {/* Decision first — the whole point of the page — with its warnings. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Publish decision</CardTitle>
        </CardHeader>
        <CardContent>
          <ReviewPageActions propertyId={id} warnings={warnings} />
        </CardContent>
      </Card>

      {/* Photos: tag the source-post pile into rooms, discard the junk. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Photos</CardTitle>
        </CardHeader>
        <CardContent>
          <PhotoManager propertyId={id} bhk={listing.bhk} photos={photos} staged={staged} />
        </CardContent>
      </Card>

      {/* Details: everything editable in place, so a bad parse is a quick fix. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <ListingForm
            action={updateListing}
            areas={areas}
            posterRole={posterRole}
            hiddenFields={{ propertyId: id, returnTo: `/admin/listings/${id}` }}
            submitLabel="Save changes"
            pendingLabel="Saving…"
            hint="Fix anything the parser got wrong. Saving keeps it in review — it doesn't publish."
            initial={{
              title: listing.title,
              areaId: listing.area_id ?? "",
              description: listing.description ?? "",
              addressLine: listing.address_line ?? "",
              bhk: listing.bhk,
              furnishing: listing.furnishing,
              occupancy: listing.occupancy_pref,
              rent: String(listing.rent),
              deposit: String(listing.deposit),
              maintenanceMonthly: String(listing.maintenance_monthly),
              brokerage: String(listing.brokerage),
              brokerageDisclosed: listing.brokerage_disclosed,
              latitude: listing.latitude,
              longitude: listing.longitude,
              oneTimeCharges: String(listing.one_time_charges),
              availableFrom: listing.available_from,
              availability: listing.availability,
              sourceName: source?.source_name ?? "",
              sourcePhone: source?.source_phone ?? "",
              sourceNote: source?.note ?? "",
            }}
          />
        </CardContent>
      </Card>
    </AdminShell>
  );
}
