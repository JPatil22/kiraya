import Link from "next/link";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { OpenModeSeedHint } from "@/components/open-mode-seed-hint";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/admin-guard";
import { getOpenReports } from "@/lib/admin";
import { MISMATCH_OPTIONS, labelFor } from "@/lib/constants";
import type { Property } from "@/types/database";
import { TriageForm } from "./triage-form";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
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

  const reports = await getOpenReports(ctx.supabase);

  // Group by listing: two reports on one unit is the signal, not two singles.
  const byProperty = new Map<string, typeof reports>();
  for (const r of reports) {
    byProperty.set(r.property_id, [...(byProperty.get(r.property_id) ?? []), r]);
  }

  const titles = new Map<string, Property>();
  await Promise.all(
    [...byProperty.keys()].map(async (id) => {
      const { data } = await ctx.supabase
        .from("properties")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (data) titles.set(id, data);
    }),
  );

  return (
    <AdminShell
      active="/admin/reports"
      title="Mismatch reports"
      description="Tenants telling you a listing lied. Two open reports on one listing shows a public warning until you close them."
    >
      {reports.length === 0 ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-success" /> No open reports. The feed is clean.
          </CardContent>
        </Card>
      ) : (
        [...byProperty.entries()].map(([propertyId, group]) => {
          const property = titles.get(propertyId);
          const warning = group.length >= 2;

          return (
            <Card key={propertyId} className={warning ? "border-destructive/50" : undefined}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <CardTitle className="text-base">
                    {property ? (
                      <Link href={`/listings/${propertyId}`} className="hover:underline">
                        {property.title}
                      </Link>
                    ) : (
                      "Unknown listing"
                    )}
                  </CardTitle>
                  {warning ? (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="size-3.5" />
                      Warning showing publicly
                    </Badge>
                  ) : (
                    <Badge variant="outline">{group.length} report</Badge>
                  )}
                </div>
                <CardDescription>
                  {warning
                    ? "Every tenant viewing this listing currently sees a warning banner."
                    : "One more report and a public warning appears."}
                </CardDescription>
              </CardHeader>

              <CardContent>
                <ul className="divide-y">
                  {group.map((r) => (
                    <li key={r.id} className="space-y-3 py-4 first:pt-0 last:pb-0">
                      <div>
                        <p className="text-sm font-medium">
                          {labelFor(
                            MISMATCH_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
                            r.type,
                          )}
                        </p>
                        {r.description ? (
                          <p className="mt-1 text-sm text-muted-foreground">
                            &ldquo;{r.description}&rdquo;
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs text-muted-foreground">
                          Reported {format(new Date(r.created_at), "d MMM yyyy")}
                        </p>
                      </div>
                      <TriageForm reportId={r.id} />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })
      )}
    </AdminShell>
  );
}
