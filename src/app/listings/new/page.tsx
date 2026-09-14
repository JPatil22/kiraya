import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { OpenModeSeedHint } from "@/components/open-mode-seed-hint";
import { PageHeader } from "@/components/ui/page-header";
import { canPost, getDataClient, getDevRole, getSessionUser } from "@/lib/auth";
import { OPEN_MODE } from "@/lib/open-mode";
import { ListingForm } from "@/components/listings/listing-form";
import { getAreas } from "@/lib/areas";
import { createListing } from "./actions";

export const dynamic = "force-dynamic";

export default async function NewListingPage() {
  const supabase = await getDataClient();
  const user = await getSessionUser(supabase);

  if (!user) {
    if (!OPEN_MODE) redirect("/login");
    const devRole = await getDevRole();
    return (
      <div className="min-h-dvh">
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-6 py-8">
          <OpenModeSeedHint role={devRole} />
        </main>
      </div>
    );
  }

  // Tenants have no reason to be here; send them to the feed. (In open mode,
  // switch the acting role in the header to reach this page.)
  if (!canPost(user.role)) redirect("/listings");

  const areas = await getAreas(supabase);

  return (
    <div className="min-h-dvh">
      <SiteHeader />

      <main className="mx-auto max-w-2xl space-y-6 px-6 py-10">
        <PageHeader
          title="Post a property"
          description="Costs are itemised on purpose — tenants see exactly what they'll pay, so you get fewer wasted visits. Your listing goes to review before it appears publicly."
        />

            <ListingForm
              action={createListing}
              areas={areas}
              posterRole={user.role}
              submitLabel="Submit for review"
              pendingLabel="Submitting…"
              hint="Goes live after review, stamped with a verification date."
            />
      </main>
    </div>
  );
}
