import Link from "next/link";
import { Copy, ShieldCheck } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { OpenModeSeedHint } from "@/components/open-mode-seed-hint";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireAdminPage } from "@/lib/admin-guard";
import { getDuplicateCandidates } from "@/lib/insights";
import { formatINR } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Possible duplicates — a moderation queue, not a verdict.
 *
 * The same flat posted by three brokers at three prices is the defining plague
 * of Indian rental sites: the tenant is wasted three times and the feed looks
 * three times deeper than it is. But two genuinely different flats in one
 * society at the same rent are ordinary, so nothing here is collapsed
 * automatically — a person decides, and the existing takedown does the rest.
 */
export default async function AdminDuplicatesPage() {
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

  const pairs = await getDuplicateCandidates(ctx.supabase);

  return (
    <AdminShell
      active="/admin/duplicates"
      title="Possible duplicates"
      description="Pairs that share a configuration, an area and near-identical cost, with similar addresses. Flagged for a human — nothing is merged automatically."
    >
      {pairs.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <ShieldCheck className="mx-auto size-8 text-muted-foreground" />
          <h2 className="mt-3 font-semibold">No likely duplicates</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Every live listing looks distinct on configuration, area, cost and address.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {pairs.map((pair) => (
            <li
              key={`${pair.property_id}-${pair.other_id}`}
              className="rounded-xl border p-4"
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Copy className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {Math.round(pair.address_similarity * 100)}% address match
                </span>
                {pair.different_posters ? (
                  <Badge variant="destructive">different posters</Badge>
                ) : (
                  <Badge variant="outline">same poster</Badge>
                )}
                {pair.area_name ? <Badge variant="secondary">{pair.area_name}</Badge> : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Side
                  id={pair.property_id}
                  title={pair.title}
                  allIn={pair.all_in_monthly}
                />
                <Side
                  id={pair.other_id}
                  title={pair.other_title}
                  allIn={pair.other_all_in_monthly}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}

function Side({ id, title, allIn }: { id: string; title: string; allIn: number }) {
  return (
    <div className="rounded-lg border bg-muted/40 p-3">
      <p className="truncate text-sm font-medium">{title}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{formatINR(allIn)}/mo all-in</p>
      <Button asChild size="sm" variant="outline" className="mt-2">
        <Link href={`/listings/${id}`}>Open</Link>
      </Button>
    </div>
  );
}
