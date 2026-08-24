import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { OpenModeSeedHint } from "@/components/open-mode-seed-hint";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { IntentForm } from "@/components/intents/intent-form";
import { getDataClient, getDevRole, getSessionUser } from "@/lib/auth";
import { OPEN_MODE } from "@/lib/open-mode";
import { getActiveLocality } from "@/lib/locality";
import { getAreas } from "@/lib/areas";
import { saveIntent } from "./actions";

export const dynamic = "force-dynamic";

/**
 * The standing "what I'm looking for" screen.
 *
 * Separate from `/onboarding/intent` on purpose: onboarding is a one-time
 * funnel that middleware closes off the moment it's finished, but an intent is
 * a living thing — budgets move, dates slip, and brokers are reading it the
 * whole time. Previously there was no route at all where a tenant could change
 * theirs.
 */
export default async function IntentPage() {
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

  if (user.role !== "tenant") redirect("/dashboard");

  const [locality, areas, { data: intent }] = await Promise.all([
    getActiveLocality(supabase),
    getAreas(supabase),
    supabase
      .from("tenant_intents")
    .select("*")
      .eq("tenant_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    <div className="min-h-dvh">
      <SiteHeader />

      <main className="mx-auto max-w-2xl space-y-6 px-6 py-8">
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/dashboard">
            <ArrowLeft /> Dashboard
          </Link>
        </Button>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {intent ? "What you're looking for" : "Tell us what you're looking for"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Brokers in {locality?.name ?? "your locality"} see this — the requirements, never your contact details. Keeping
            it current is what gets you suggestions worth reading.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <IntentForm
              action={saveIntent}
              areas={areas}
              submitLabel={intent ? "Save changes" : "Save and continue"}
              initial={
                intent
                  ? {
                      areaId: intent.area_id ?? "",
                      budgetMin: String(intent.budget_min),
                      budgetMax: String(intent.budget_max),
                      bhk: intent.bhk,
                      moveInDate: intent.move_in_date,
                      furnishing: intent.furnishing,
                      occupancy: intent.occupancy,
                      notes: intent.notes ?? "",
                    }
                  : undefined
              }
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
