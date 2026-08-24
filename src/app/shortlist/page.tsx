import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { Bookmark } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { OpenModeSeedHint } from "@/components/open-mode-seed-hint";
import { ListingCard } from "@/components/listings/listing-card";
import { SaveButton } from "@/components/listings/save-button";
import { Button } from "@/components/ui/button";
import { getDataClient, getDevRole, getSessionUser } from "@/lib/auth";
import { OPEN_MODE } from "@/lib/open-mode";
import { getSavedListings, type SavedListing } from "@/lib/shortlist";
import { formatUpdateField, formatUpdateValue } from "@/lib/history";

export const dynamic = "force-dynamic";

export default async function ShortlistPage() {
  const supabase = await getDataClient();
  const user = await getSessionUser(supabase);

  if (!user) {
    if (!OPEN_MODE) redirect("/login");
    const devRole = await getDevRole();
    return (
      <div className="min-h-dvh">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-6 py-8">
          <OpenModeSeedHint role={devRole} />
        </main>
      </div>
    );
  }

  const saved = await getSavedListings(supabase, user.id);
  const movedCount = saved.filter((s) => s.changes.length > 0).length;

  return (
    <div className="min-h-dvh">
      <SiteHeader />

      <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Saved listings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {movedCount > 0 ? (
              <>
                <span className="font-medium text-foreground">
                  {movedCount} of these changed
                </span>{" "}
                since you saved {movedCount === 1 ? "it" : "them"} — the price, the
                availability or a fresh confirmation.
              </>
            ) : (
              "Nothing you've saved has changed since you saved it."
            )}
          </p>
        </div>

        {saved.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <Bookmark className="mx-auto size-8 text-muted-foreground" />
            <h2 className="mt-3 font-semibold">Nothing saved yet</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Save a few while you compare. This page then tells you what moved — a rent
              rise or a flat going off the market — without you having to re-check each one.
            </p>
            <Button asChild size="sm" className="mt-4">
              <Link href="/listings">Browse listings</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {saved.map((item) => (
              <SavedItem key={item.propertyId} item={item} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function SavedItem({ item }: { item: SavedItem_Props }) {
  const { listing, changes, savedAt, propertyId } = item;

  // The listing was taken down or archived, so it's gone from the read model.
  // Say so plainly rather than rendering a dead card.
  if (!listing) {
    return (
      <div className="rounded-xl border border-dashed p-5">
        <p className="font-medium">This listing is no longer available</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          It was taken down after you saved it on {format(new Date(savedAt), "d MMM yyyy")}.
        </p>
        <div className="mt-3">
          <SaveButton propertyId={propertyId} saved variant="inline" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <ListingCard listing={listing} saved />

      {changes.length > 0 ? (
        <div className="rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm">
          <p className="font-medium">
            Changed since you saved this on {format(new Date(savedAt), "d MMM")}
          </p>
          <ul className="mt-1 space-y-0.5 text-muted-foreground">
            {changes.slice(0, 4).map((change) => (
              <li key={change.id}>
                <span className="font-medium text-foreground">
                  {formatUpdateField(change.field)}
                </span>{" "}
                {formatUpdateValue(change.field, change.old_value)} →{" "}
                <span className="font-medium text-foreground">
                  {formatUpdateValue(change.field, change.new_value)}
                </span>{" "}
                · {format(new Date(change.created_at), "d MMM")}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

type SavedItem_Props = SavedListing;
