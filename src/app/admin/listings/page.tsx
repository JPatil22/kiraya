import Link from "next/link";
import { format } from "date-fns";
import { CheckCircle2 } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { OpenModeSeedHint } from "@/components/open-mode-seed-hint";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/admin-guard";
import { getLiveListings, getReviewQueue } from "@/lib/admin";
import { getActiveLocality } from "@/lib/locality";
import { BHK_OPTIONS, FURNISHING_OPTIONS, labelFor } from "@/lib/constants";
import { formatINR } from "@/lib/utils";
import type { Property } from "@/types/database";
import { MaintenanceDecision, ReviewDecision } from "./decision-form";

export const dynamic = "force-dynamic";

export default async function AdminListingsPage() {
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

  const locality = await getActiveLocality(ctx.supabase);
  const [queue, live] = locality
    ? await Promise.all([
        getReviewQueue(ctx.supabase, locality.id),
        getLiveListings(ctx.supabase, locality.id),
      ])
    : [[], []];

  const staleCutoff = Date.now() - (locality?.verify_stale_days ?? 7) * 86_400_000;
  const isStale = (p: Property) =>
    p.last_verified_at === null || Date.parse(p.last_verified_at) < staleCutoff;

  return (
    <AdminShell
      active="/admin/listings"
      title="Listings"
      description="Approving a listing stamps it verified — that date is what tenants judge it by. Only you can set it."
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Awaiting review{queue.length > 0 ? ` (${queue.length})` : ""}
          </CardTitle>
          <CardDescription>
            Posted by an owner or broker, not yet public. Oldest first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {queue.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-success" /> Queue is clear.
            </p>
          ) : (
            <ul className="divide-y">
              {queue.map((p) => (
                <li key={p.id} className="space-y-3 py-4 first:pt-0 last:pb-0">
                  <Summary property={p} />
                  <ReviewDecision propertyId={p.id} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Live ({live.length})</CardTitle>
          <CardDescription>
            Oldest verification first — the top of this list is what needs a call.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {live.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing live yet.</p>
          ) : (
            <ul className="divide-y">
              {live.map((p) => (
                <li key={p.id} className="space-y-3 py-4 first:pt-0 last:pb-0">
                  <Summary property={p} stale={isStale(p)} live />
                  <MaintenanceDecision propertyId={p.id} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </AdminShell>
  );
}

function Summary({
  property: p,
  stale,
  live,
}: {
  property: Property;
  stale?: boolean;
  live?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="font-medium">
          {live ? (
            <Link href={`/listings/${p.id}`} className="hover:underline">
              {p.title}
            </Link>
          ) : (
            p.title
          )}
        </div>
        <div className="mt-0.5 text-sm text-muted-foreground">
          {labelFor(BHK_OPTIONS, p.bhk)} · {labelFor(FURNISHING_OPTIONS, p.furnishing)} ·{" "}
          {formatINR(p.rent + p.maintenance_monthly)}/mo all-in ·{" "}
          {formatINR(p.deposit + p.brokerage + p.one_time_charges)} to move in
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          Posted {format(new Date(p.created_at), "d MMM yyyy")}
          {p.last_verified_at
            ? ` · verified ${format(new Date(p.last_verified_at), "d MMM yyyy")}`
            : " · never verified"}
        </div>
      </div>
      {stale ? <Badge variant="warning">Stale</Badge> : null}
    </div>
  );
}
