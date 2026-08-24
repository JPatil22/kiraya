import Link from "next/link";
import { AlertTriangle, BadgeCheck, ClipboardList, Home, Users } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { OpenModeSeedHint } from "@/components/open-mode-seed-hint";
import { SiteHeader } from "@/components/site-header";
import { requireAdminPage } from "@/lib/admin-guard";
import { getLocalityHealth } from "@/lib/admin";
import { ACTIVE_LOCALITY_SLUG } from "@/lib/locality";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminHealthPage() {
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

  const health = await getLocalityHealth(ctx.supabase, ACTIVE_LOCALITY_SLUG);

  // The headline number: what share of live listings is actually fresh.
  const freshness =
    health && health.live_count > 0
      ? Math.round(((health.live_count - health.stale_count) / health.live_count) * 100)
      : null;

  return (
    <AdminShell
      active="/admin"
      title={`Locality health — ${health?.name ?? "—"}`}
      description="Whether this neighbourhood's data is still true. Freshness above 85% is the target."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          icon={BadgeCheck}
          label="Freshness"
          value={freshness === null ? "—" : `${freshness}%`}
          hint={
            health
              ? `${health.live_count - health.stale_count} of ${health.live_count} live verified in window`
              : ""
          }
          tone={freshness === null ? "neutral" : freshness >= 85 ? "good" : "bad"}
        />
        <Stat
          icon={ClipboardList}
          label="Awaiting review"
          value={health?.pending_count ?? 0}
          hint="Posted but not yet public"
          tone={(health?.pending_count ?? 0) > 0 ? "warn" : "neutral"}
          href="/admin/listings"
        />
        <Stat
          icon={AlertTriangle}
          label="Open mismatches"
          value={health?.open_mismatch_count ?? 0}
          hint="Reported by tenants, untriaged"
          tone={(health?.open_mismatch_count ?? 0) > 0 ? "bad" : "neutral"}
          href="/admin/reports"
        />
        <Stat
          icon={Home}
          label="Live listings"
          value={health?.live_count ?? 0}
          hint={`${health?.available_count ?? 0} still marked available`}
        />
        <Stat
          icon={AlertTriangle}
          label="Stale"
          value={health?.stale_count ?? 0}
          hint="Past the verification window"
          tone={(health?.stale_count ?? 0) > 0 ? "warn" : "neutral"}
          href="/admin/listings"
        />
        <Stat
          icon={Users}
          label="Active tenants"
          value={health?.active_tenant_count ?? 0}
          hint="Verified, with a live intent"
        />
      </div>

      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Supply is only as good as its freshness.</span>{" "}
        A stale listing costs a tenant a phone call and some trust — re-verify from{" "}
        <Link href="/admin/listings" className="underline">
          Listings
        </Link>
        , oldest first.
      </div>
    </AdminShell>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  tone = "neutral",
  href,
}: {
  icon: typeof Home;
  label: string;
  value: string | number;
  hint: string;
  tone?: "neutral" | "good" | "warn" | "bad";
  href?: string;
}) {
  const body = (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" />
        {label}
      </div>
      <div
        className={cn(
          "mt-2 text-3xl font-bold tabular-nums",
          tone === "good" && "text-success",
          tone === "warn" && "text-warning",
          tone === "bad" && "text-destructive",
        )}
      >
        {value}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );

  if (!href) return body;
  return (
    <Link href={href} className="block transition-colors hover:opacity-90">
      {body}
    </Link>
  );
}
