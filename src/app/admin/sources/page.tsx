import Link from "next/link";
import { Phone, PhoneOff, Contact } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { OpenModeSeedHint } from "@/components/open-mode-seed-hint";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { requireAdminPage } from "@/lib/admin-guard";
import { getSourceGroups } from "@/lib/listing-source";

export const dynamic = "force-dynamic";

/**
 * Seed sources, grouped by number (0034).
 *
 * When supply is bootstrapped by posting flats sourced from Facebook, the real
 * broker's details are kept privately per listing. This gathers them by phone
 * number so an admin can see which flats came from the same person — the
 * call-list when a tenant bites, and the tell when one number is quietly
 * feeding several listings or reposting one flat.
 *
 * None of this is ever on the public page or in a contact exchange. It only
 * exists for whoever is running the seeding.
 */
export default async function AdminSourcesPage() {
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

  const groups = await getSourceGroups(ctx.supabase);

  return (
    <AdminShell
      active="/admin/sources"
      title="Seed sources"
      description="Where seeded listings came from, grouped by the source's number — private, never shown to tenants. One number behind several listings is worth a look."
    >
      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <Contact className="mx-auto size-8 text-muted-foreground" />
          <h2 className="mt-3 font-semibold">No sources recorded</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            When you post a seeded listing, fill in “Where did this come from?” on the form and it
            shows up here, grouped by number.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {groups.map((group) => {
            const hasNumber = group.key !== "(no number)";
            return (
              <li key={group.key} className="rounded-xl border p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {hasNumber ? (
                    <Phone className="size-4 text-muted-foreground" />
                  ) : (
                    <PhoneOff className="size-4 text-muted-foreground" />
                  )}
                  <span className="font-semibold tabular-nums">
                    {hasNumber ? group.phone : "No number given"}
                  </span>
                  {group.name ? (
                    <span className="text-sm text-muted-foreground">· {group.name}</span>
                  ) : null}
                  <Badge variant={group.listings.length > 1 ? "warning" : "secondary"}>
                    {group.listings.length} listing{group.listings.length === 1 ? "" : "s"}
                  </Badge>
                  {group.listings.length > 1 ? (
                    <span className="text-xs text-muted-foreground">
                      same number — check for reposts of one flat
                    </span>
                  ) : null}
                </div>
                <ul className="space-y-1.5">
                  {group.listings.map((l) => (
                    <li key={l.property_id} className="flex flex-wrap items-center gap-2 text-sm">
                      <Link
                        href={`/listings/${l.property_id}`}
                        className="font-medium underline underline-offset-2 hover:text-foreground"
                      >
                        {l.title}
                      </Link>
                      <Badge variant="outline" className="text-xs capitalize">
                        {l.status.replace(/_/g, " ")}
                      </Badge>
                      {l.note ? (
                        <span className="text-xs text-muted-foreground">— {l.note}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </AdminShell>
  );
}
