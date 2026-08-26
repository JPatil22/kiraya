import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { ListingForm } from "@/components/listings/listing-form";
import { getDataClient, getSessionUser } from "@/lib/auth";
import { OPEN_MODE } from "@/lib/open-mode";
import { getAreas } from "@/lib/areas";
import { getPosterRole } from "@/lib/brokerage";
import { updateListing } from "../actions";

export const dynamic = "force-dynamic";

/**
 * Edit an existing listing. Reads `properties` directly rather than
 * `v_listings_public`, because the poster needs the raw stored values to edit —
 * the view exposes computed totals (all_in_monthly, move_in_cost) which aren't
 * fields anyone types.
 */
export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getDataClient();
  const user = await getSessionUser(supabase);

  if (!user) {
    if (!OPEN_MODE) redirect("/login");
    return notFound();
  }

  const areas = await getAreas(supabase);

  const { data: listing } = await supabase
    .from("properties")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!listing) notFound();

  // Same rule as the photo manager: your listing, or an admin's.
  if (listing.posted_by !== user.id && user.role !== "admin") {
    redirect(`/listings/${id}`);
  }

  // 0023 judges the fee by whose listing it is, not who is editing it.
  const posterRole =
    listing.posted_by === user.id ? user.role : await getPosterRole(supabase, listing.posted_by);

  return (
    <div className="min-h-dvh">
      <SiteHeader />

      <main className="mx-auto max-w-2xl space-y-6 px-6 py-8">
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href={`/listings/${id}`}>
            <ArrowLeft /> Back to listing
          </Link>
        </Button>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Edit listing</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every change is recorded on the public timeline with the date — tenants see what
            moved and when. Saving also counts as confirming the listing is current.
          </p>
        </div>

            <ListingForm
              action={updateListing}
              areas={areas}
              posterRole={posterRole}
              hiddenFields={{ propertyId: id }}
              submitLabel="Save changes"
              pendingLabel="Saving…"
              hint="Saving re-stamps the freshness date in your name."
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
              }}
            />
      </main>
    </div>
  );
}
