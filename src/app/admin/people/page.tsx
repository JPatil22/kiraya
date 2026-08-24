import { format } from "date-fns";
import { AdminShell } from "@/components/admin/admin-shell";
import { OpenModeSeedHint } from "@/components/open-mode-seed-hint";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/admin-guard";
import { getPosters } from "@/lib/admin";
import { SuspendForm } from "./suspend-form";

export const dynamic = "force-dynamic";

export default async function AdminPeoplePage() {
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

  const people = await getPosters(ctx.supabase);

  // Who posts what — the number that matters next to a broker's name.
  const { data: properties } = await ctx.supabase.from("properties").select("*");
  const listingCount = new Map<string, { live: number; total: number }>();
  for (const p of properties ?? []) {
    const current = listingCount.get(p.posted_by) ?? { live: 0, total: 0 };
    current.total += 1;
    if (p.status === "live") current.live += 1;
    listingCount.set(p.posted_by, current);
  }

  return (
    <AdminShell
      active="/admin/people"
      title="Owners &amp; brokers"
      description="Suspension is enforced by the database: a suspended account can't post a listing or send a suggestion."
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Posters ({people.length})</CardTitle>
          <CardDescription>
            Tenants aren&apos;t listed — they have nothing to moderate.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {people.map((person) => {
              const counts = listingCount.get(person.id) ?? { live: 0, total: 0 };
              const isSelf = person.id === ctx.user.id;

              return (
                <li key={person.id} className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{person.full_name ?? "Unnamed"}</span>
                      <Badge variant="secondary" className="capitalize">
                        {person.role}
                      </Badge>
                      {person.is_suspended ? (
                        <Badge variant="destructive">Suspended</Badge>
                      ) : null}
                      {isSelf ? <Badge variant="outline">You</Badge> : null}
                    </div>
                    <div className="mt-0.5 text-sm text-muted-foreground">
                      <span className="font-mono text-xs">{person.phone}</span> ·{" "}
                      {counts.live} live / {counts.total} listing
                      {counts.total === 1 ? "" : "s"} · joined{" "}
                      {format(new Date(person.created_at), "d MMM yyyy")}
                    </div>
                  </div>

                  {isSelf ? null : (
                    <SuspendForm userId={person.id} suspended={person.is_suspended} />
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </AdminShell>
  );
}
