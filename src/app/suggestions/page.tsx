import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { Inbox, MessageSquareQuote, Phone } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { OpenModeSeedHint } from "@/components/open-mode-seed-hint";
import { ListingCard } from "@/components/listings/listing-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDataClient, getDevRole, getSessionUser } from "@/lib/auth";
import { OPEN_MODE } from "@/lib/open-mode";
import { getInbox } from "@/lib/suggestions";
import { getCounterparty, telHref } from "@/lib/contact";
import { SUGGESTION_STATUS } from "@/lib/constants";
import { RespondButtons } from "./respond-buttons";

export const dynamic = "force-dynamic";

export default async function SuggestionsPage() {
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

  const inbox = await getInbox(supabase, user.id);

  // 0010: an accepted suggestion exchanges contact, so resolve the broker's
  // details for those. Keyed by property, matching how an exchange is scoped.
  const accepted = inbox.filter((i) => i.suggestion.status === "accepted");
  const brokerContacts = new Map(
    await Promise.all(
      accepted.map(async (i) => {
        const profile = await getCounterparty(supabase, i.suggestion.broker_id);
        return [i.suggestion.id, profile] as const;
      }),
    ),
  );
  const open = inbox.filter((i) => i.suggestion.status === "sent" || i.suggestion.status === "viewed");

  return (
    <div className="min-h-dvh">
      <SiteHeader />

      <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Suggestions for you</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Brokers can only suggest listings that are already live and verified on Kiraya —
            so every card here has the full cost breakdown you&apos;d see in the feed.
          </p>
        </div>

        {inbox.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <Inbox className="mx-auto size-8 text-muted-foreground" />
            <h2 className="mt-3 font-semibold">Nothing suggested yet</h2>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Brokers in your locality can see what you&apos;re looking for (never your contact
              details) and will suggest matching listings here.
            </p>
            <Button asChild size="sm" className="mt-4">
              <Link href="/listings">Browse listings yourself</Link>
            </Button>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {inbox.length} suggestion{inbox.length === 1 ? "" : "s"}
              {open.length > 0 ? ` · ${open.length} awaiting your response` : null}
            </p>

            <div className="space-y-6">
              {inbox.map(({ suggestion, listing }) => {
                const status = SUGGESTION_STATUS[suggestion.status];
                const answered =
                  suggestion.status !== "sent" && suggestion.status !== "viewed";

                return (
                  <div key={suggestion.id} className="space-y-3 rounded-xl border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        Suggested by a broker ·{" "}
                        {format(new Date(suggestion.created_at), "d MMM yyyy")}
                      </span>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>

                    {suggestion.message ? (
                      <p className="flex gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
                        <MessageSquareQuote className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        {suggestion.message}
                      </p>
                    ) : null}

                    {listing ? (
                      <ListingCard listing={listing} />
                    ) : (
                      <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                        This listing is no longer live.
                      </p>
                    )}

                    {answered ? (
                      <p className="text-sm text-muted-foreground">
                        You marked this{" "}
                        <span className="font-medium">{status.label.toLowerCase()}</span>
                        {suggestion.responded_at
                          ? ` on ${format(new Date(suggestion.responded_at), "d MMM yyyy")}`
                          : null}
                        .
                        {suggestion.status === "accepted" ? " Contact was shared." : null}
                      </p>
                    ) : (
                      <RespondButtons suggestionId={suggestion.id} />
                    )}

                    {suggestion.status === "accepted"
                      ? (() => {
                          const broker = brokerContacts.get(suggestion.id);
                          const href = telHref(broker?.phone);
                          return (
                            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-success/40 bg-success/10 p-3 text-sm">
                              <Phone className="size-4 shrink-0 text-success" />
                              <span>
                                <span className="font-medium">
                                  {broker?.full_name ?? "The broker"}
                                </span>
                                {broker?.phone ? (
                                  <span className="ml-2 font-mono tabular-nums">
                                    {broker.phone}
                                  </span>
                                ) : (
                                  " — no number on file."
                                )}
                              </span>
                              {href ? (
                                <Button asChild size="sm" className="ml-auto">
                                  <a href={href}>Call</a>
                                </Button>
                              ) : null}
                            </div>
                          );
                        })()
                      : null}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
