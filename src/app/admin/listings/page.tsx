import Link from "next/link";
import { format } from "date-fns";
import { Camera, CameraOff, CheckCircle2 } from "lucide-react";
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
import { getPhotoCountsForProperties } from "@/lib/photos";
import type { Property } from "@/types/database";
import { MaintenanceDecision, ReviewDecision } from "./decision-form";

export const dynamic = "force-dynamic";

export default async function AdminListingsPage(props: {
  searchParams?: Promise<{ filter?: string }>;
}) {
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

  const searchParams = props.searchParams ? await props.searchParams : {};
  const activeFilter = searchParams.filter;

  const locality = await getActiveLocality(ctx.supabase);
  const [queue, live] = locality
    ? await Promise.all([
        getReviewQueue(ctx.supabase, locality.id),
        getLiveListings(ctx.supabase, locality.id),
      ])
    : [[], []];

  // Batch query photo counts for all properties
  const allPropertyIds = [...queue, ...live].map((p) => p.id);
  const photoCounts = await getPhotoCountsForProperties(ctx.supabase, allPropertyIds);

  const staleCutoff = Date.now() - (locality?.verify_stale_days ?? 7) * 86_400_000;
  const isStale = (p: Property) =>
    p.last_verified_at === null || Date.parse(p.last_verified_at) < staleCutoff;

  const noPhotosCount = live.filter((p) => (photoCounts[p.id] ?? 0) === 0).length;
  const staleCount = live.filter(isStale).length;

  const filteredLive =
    activeFilter === "no_photos"
      ? live.filter((p) => (photoCounts[p.id] ?? 0) === 0)
      : activeFilter === "stale"
      ? live.filter(isStale)
      : live;

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
                  <Summary property={p} photoCount={photoCounts[p.id] ?? 0} review />
                  <ReviewDecision propertyId={p.id} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">
                Live ({filteredLive.length}{filteredLive.length !== live.length ? ` of ${live.length}` : ""})
              </CardTitle>
              <CardDescription>
                Oldest verification first — review photos, edit details, or delete wrong listings.
              </CardDescription>
            </div>

            {/* Quick Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
              <Link
                href="/admin/listings"
                className={`rounded-full px-3 py-1 transition ${
                  !activeFilter
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                All ({live.length})
              </Link>
              <Link
                href="/admin/listings?filter=no_photos"
                className={`rounded-full px-3 py-1 transition flex items-center gap-1 ${
                  activeFilter === "no_photos"
                    ? "bg-amber-600 text-white font-semibold"
                    : "bg-amber-500/15 text-amber-800 dark:text-amber-300 hover:bg-amber-500/25 border border-amber-500/30"
                }`}
              >
                <CameraOff className="size-3" /> No photos ({noPhotosCount})
              </Link>
              <Link
                href="/admin/listings?filter=stale"
                className={`rounded-full px-3 py-1 transition ${
                  activeFilter === "stale"
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                Stale ({staleCount})
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredLive.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              {activeFilter === "no_photos"
                ? "Great news! All live listings currently have photos attached."
                : "Nothing live matches this filter."}
            </p>
          ) : (
            <ul className="divide-y">
              {filteredLive.map((p) => (
                <li key={p.id} className="space-y-3 py-4 first:pt-0 last:pb-0">
                  <Summary property={p} photoCount={photoCounts[p.id] ?? 0} stale={isStale(p)} live />
                  <MaintenanceDecision propertyId={p.id} photoCount={photoCounts[p.id] ?? 0} />
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
  photoCount = 0,
  stale,
  live,
  review,
}: {
  property: Property;
  photoCount?: number;
  stale?: boolean;
  live?: boolean;
  review?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 font-medium">
          {live ? (
            <Link href={`/listings/${p.id}`} className="hover:underline">
              {p.title}
            </Link>
          ) : review ? (
            <Link href={`/admin/listings/${p.id}`} className="hover:underline">
              {p.title}
            </Link>
          ) : (
            p.title
          )}

          {/* Photo count badge */}
          {photoCount === 0 ? (
            <Badge
              variant="destructive"
              className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1 font-semibold text-xs py-0.5 px-2"
            >
              <CameraOff className="size-3" /> 0 photos
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="gap-1 text-slate-700 dark:text-slate-300 font-medium text-xs py-0.5 px-2 bg-slate-100/70 dark:bg-slate-800/70"
            >
              <Camera className="size-3" /> {photoCount} photo{photoCount === 1 ? "" : "s"}
            </Badge>
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
