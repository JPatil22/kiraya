import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { OpenModeSeedHint } from "@/components/open-mode-seed-hint";
import { Card, CardContent } from "@/components/ui/card";
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

      <main className="mx-auto max-w-2xl space-y-6 px-6 py-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Post a property</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Costs are itemised on purpose — tenants see exactly what they&apos;ll pay, so you
            get fewer wasted visits. Your listing goes to review before it appears publicly.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <ListingForm
              action={createListing}
              areas={areas}
              posterRole={user.role}
              submitLabel="Submit for review"
              pendingLabel="Submitting…"
              hint="Goes live after review, stamped with a verification date."
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
