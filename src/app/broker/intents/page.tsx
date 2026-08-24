import { redirect } from "next/navigation";
import { format } from "date-fns";
import { Inbox, ShieldCheck, Users } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { OpenModeSeedHint } from "@/components/open-mode-seed-hint";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDataClient, getDevRole, getSessionUser } from "@/lib/auth";
import { OPEN_MODE } from "@/lib/open-mode";
import { getActiveLocality } from "@/lib/locality";
import { getActiveIntents, getSentSuggestions, getSuggestableListings } from "@/lib/suggestions";
import {
  BHK_OPTIONS,
  FURNISHING_OPTIONS,
  OCCUPANCY_OPTIONS,
  SUGGESTION_STATUS,
  labelFor,
} from "@/lib/constants";
import { formatINR } from "@/lib/utils";
import { SuggestForm } from "./suggest-form";

export const dynamic = "force-dynamic";

export default async function BrokerIntentsPage() {
  const supabase = await getDataClient();
  const user = await getSessionUser(supabase);

  if (!user) {
    if (!OPEN_MODE) redirect("/login");
    const devRole = await getDevRole();
    return (
      <div className="min-h-dvh">
        <SiteHeader />
        <main className="mx-auto max-w-4xl px-6 py-8">
          <OpenModeSeedHint role={devRole} />
        </main>
      </div>
    );
  }

  // Brokers only — this is the demand side of the market.
  if (user.role !== "broker") redirect("/dashboard");

  const locality = await getActiveLocality(supabase);
  if (!locality) redirect("/dashboard");

  const [intents, listings, sent] = await Promise.all([
    getActiveIntents(supabase, locality.id),
    getSuggestableListings(supabase, user.id),
    getSentSuggestions(supabase, user.id),
  ]);

  // intent id → the property ids already suggested to it.
  const sentByIntent = new Map<string, Set<string>>();
  for (const s of sent) {
    const set = sentByIntent.get(s.tenant_intent_id) ?? new Set<string>();
    set.add(s.property_id);
    sentByIntent.set(s.tenant_intent_id, set);
  }

  return (
    <div className="min-h-dvh">
      <SiteHeader />

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Verified tenant demand</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Phone-verified tenants actively looking in {locality.name}. Suggest a live listing
            and they get a card with the full verified cost — no WhatsApp, no forwarding.
          </p>
        </div>

        <div className="flex items-start gap-3 rounded-xl border bg-muted/40 p-4 text-sm">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">No contact details here, ever.</span>{" "}
            You see what they want, not who they are. Contact is exchanged only after a tenant
            accepts a suggestion.
          </p>
        </div>

        {intents.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <Inbox className="mx-auto size-8 text-muted-foreground" />
            <h2 className="mt-3 font-semibold">No active tenant intents yet</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              When a verified tenant fills in what they&apos;re looking for, it appears here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {intents.map((intent) => {
              const already = sentByIntent.get(intent.id) ?? new Set<string>();
              const sentHere = sent.filter((s) => s.tenant_intent_id === intent.id);

              return (
                <Card key={intent.id}>
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Users className="size-5 text-primary" />
                        <CardTitle className="text-base">
                          {labelFor(BHK_OPTIONS, intent.bhk)} ·{" "}
                          {formatINR(intent.budget_min)} – {formatINR(intent.budget_max)}
                          <span className="font-normal text-muted-foreground">/mo all-in</span>
                        </CardTitle>
                      </div>
                      <Badge variant="secondary">
                        Moving by {format(new Date(intent.move_in_date), "d MMM")}
                      </Badge>
                    </div>
                    <CardDescription>
                      {labelFor(FURNISHING_OPTIONS, intent.furnishing)} ·{" "}
                      {labelFor(OCCUPANCY_OPTIONS, intent.occupancy)} · posted{" "}
                      {format(new Date(intent.created_at), "d MMM yyyy")}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {intent.notes ? (
                      <p className="rounded-lg bg-muted px-3 py-2 text-sm">
                        &ldquo;{intent.notes}&rdquo;
                      </p>
                    ) : null}

                    {sentHere.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        You&apos;ve sent {sentHere.length}:
                        {sentHere.map((s) => (
                          <Badge key={s.id} variant={SUGGESTION_STATUS[s.status].variant}>
                            {SUGGESTION_STATUS[s.status].label}
                          </Badge>
                        ))}
                      </div>
                    ) : null}

                    <SuggestForm
                      intentId={intent.id}
                      listings={listings}
                      alreadySuggested={already}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
