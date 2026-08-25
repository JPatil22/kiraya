import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import {
  Building2,
  CheckCircle2,
  Home,
  Megaphone,
  PhoneCall,
  Plus,
  Search,
} from "lucide-react";
import { canPost, getDataClient, getDevRole, getSessionUser } from "@/lib/auth";
import { OPEN_MODE } from "@/lib/open-mode";
import { getActiveLocality } from "@/lib/locality";
import { getMyListings } from "@/lib/listings";
import { getLeads, telHref } from "@/lib/contact";
import { getPendingAsks } from "@/lib/visits";
import { getEngagementFor } from "@/lib/insights";
import { VisitAsk } from "@/components/visits/visit-ask";
import { setIntentStatus } from "@/app/intent/actions";
import { SiteHeader } from "@/components/site-header";
import { OpenModeSeedHint } from "@/components/open-mode-seed-hint";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BHK_OPTIONS,
  FURNISHING_OPTIONS,
  LISTING_STATUS,
  OCCUPANCY_OPTIONS,
  labelFor,
} from "@/lib/constants";
import { formatINR } from "@/lib/utils";
import type { TenantIntent } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { posted, intent: intentSaved } = await searchParams;
  const supabase = await getDataClient();
  const user = await getSessionUser(supabase);

  // Open mode has no login to fall back to — show the setup hint instead.
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

  const role = user.role ?? "tenant";
  const isPoster = canPost(role);
  const locality = await getActiveLocality(supabase);

  const [intent, myListings, leads, pendingAsks, engagement] = await Promise.all([
    supabase
      .from("tenant_intents")
      .select("*")
      .eq("tenant_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then((r) => r.data),
    isPoster ? getMyListings(supabase, user.id) : Promise.resolve([]),
    isPoster ? getLeads(supabase, user.id) : Promise.resolve([]),
    getPendingAsks(supabase, user.id),
    isPoster ? getEngagementFor(supabase, user.id) : Promise.resolve(new Map()),
  ]);

  return (
    <div className="min-h-dvh">
      <SiteHeader />

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome{user.fullName ? `, ${user.fullName}` : ""} 👋
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {user.isDev ? "Open-mode sandbox" : "You're verified on Kiraya"} ·{" "}
            {locality?.name ?? "your locality"} ·{" "}
            <span className="font-mono">{user.phone}</span>
          </p>
        </div>

        {user.isDev ? (
          <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Phone OTP is off.</span> You&apos;re
            acting as the seeded <span className="capitalize">{role}</span> identity — switch
            roles from the header. Set{" "}
            <span className="font-mono text-xs">NEXT_PUBLIC_OPEN_MODE=false</span> to put the
            real auth gate back.
          </div>
        ) : null}

        {posted ? (
          <div className="flex items-start gap-3 rounded-xl border border-success/50 bg-success/10 p-4">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
            <div>
              <p className="font-medium">Listing submitted for review</p>
              <p className="text-sm text-muted-foreground">
                It goes live once an admin verifies it — that verification date is what
                tenants see.
              </p>
            </div>
          </div>
        ) : null}

        {intentSaved ? (
          <div className="flex items-start gap-3 rounded-xl border border-success/50 bg-success/10 p-4">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
            <div>
              <p className="font-medium">Saved — brokers can see what you&apos;re after</p>
              <p className="text-sm text-muted-foreground">
                Suggestions land in your inbox. They never see your number until you accept one.
              </p>
            </div>
          </div>
        ) : null}

        {pendingAsks.length > 0 ? (
          <div className="space-y-3">
            {pendingAsks.slice(0, 3).map((ask) => (
              <VisitAsk
                key={ask.contactExchangeId}
                contactExchangeId={ask.contactExchangeId}
                propertyTitle={ask.propertyTitle}
              />
            ))}
          </div>
        ) : null}

        {role === "tenant" ? (
          <>
            <IntentCard intent={intent} />

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Search className="size-5 text-primary" />
                  <CardTitle>Browse verified listings</CardTitle>
                </div>
                <CardDescription>
                  Filter by budget on the all-in monthly cost, and hide anything that
                  hasn&apos;t been verified recently.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href="/listings">See listings in {locality?.name ?? "your area"}</Link>
                </Button>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  {role === "owner" ? (
                    <Building2 className="size-5 text-primary" />
                  ) : (
                    <Megaphone className="size-5 text-primary" />
                  )}
                  <CardTitle>Your listings</CardTitle>
                </div>
                <Button asChild size="sm">
                  <Link href="/listings/new">
                    <Plus /> Post a property
                  </Link>
                </Button>
              </div>
              <CardDescription>
                Listings go live after review. Keeping them verified is what keeps them
                ranked and trusted.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {myListings.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing posted yet. Your first listing takes about a minute.
                </p>
              ) : (
                <ul className="divide-y">
                  {myListings.map((l) => {
                    const s = LISTING_STATUS[l.status];
                    return (
                      <li key={l.id} className="flex items-center justify-between gap-4 py-3">
                        <div className="min-w-0">
                          <div className="truncate font-medium">
                            {l.status === "live" ? (
                              <Link href={`/listings/${l.id}`} className="hover:underline">
                                {l.title}
                              </Link>
                            ) : (
                              l.title
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {labelFor(BHK_OPTIONS, l.bhk)} ·{" "}
                            {formatINR(l.rent + l.maintenance_monthly)}/mo all-in
                            {l.last_verified_at
                              ? ` · verified ${format(new Date(l.last_verified_at), "d MMM")}`
                              : " · not verified yet"}
                          </div>
                          <Engagement stats={engagement.get(l.id)} />
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Button asChild size="sm" variant="ghost">
                            <Link href={`/listings/${l.id}/edit`}>Edit</Link>
                          </Button>
                          <Button asChild size="sm" variant="ghost">
                            <Link href={`/listings/${l.id}/photos`}>Photos</Link>
                          </Button>
                          <Badge variant={s.variant}>{s.label}</Badge>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {/*
          0024 — an intent is no longer a tenant-only object. An owner between
          places is still somebody looking to rent, and 0014's matcher already
          refuses to tell anyone about their own listing. Non-tenants who have
          not set one get a line rather than a form: nagging every owner for a
          rental budget would be noise.
        */}
        {role !== "tenant" ? (
          intent ? (
            <IntentCard intent={intent} />
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Home className="size-5 text-primary" />
                  <CardTitle>Looking for a place yourself?</CardTitle>
                </div>
                <CardDescription>
                  Say what you&apos;re after and brokers can suggest listings — the same
                  inbox a tenant gets. Nothing you posted is ever suggested back to you.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild size="sm" variant="outline">
                  <Link href="/intent">Set up a rental intent</Link>
                </Button>
              </CardContent>
            </Card>
          )
        ) : null}

        {isPoster ? (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <PhoneCall className="size-5 text-primary" />
                <CardTitle>People trying to reach you</CardTitle>
              </div>
              <CardDescription>
                Tenants who asked for your number. They already have it — calling them back
                costs you nothing and they&apos;re expecting it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {leads.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No enquiries yet. Listings with every room photographed and a fresh
                  confirmation get asked about more.
                </p>
              ) : (
                <ul className="divide-y">
                  {leads.map((lead) => {
                    const href = telHref(lead.tenant?.phone);
                    return (
                      <li key={lead.id} className="space-y-1 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-medium">
                            {lead.tenant?.full_name ?? "A tenant"}
                            {lead.tenant?.phone ? (
                              <span className="ml-2 font-mono text-sm font-normal tabular-nums">
                                {lead.tenant.phone}
                              </span>
                            ) : null}
                          </div>
                          {href ? (
                            <Button asChild size="sm" variant="outline">
                              <a href={href}>
                                <PhoneCall /> Call back
                              </a>
                            </Button>
                          ) : null}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {lead.propertyTitle ?? "a listing"} ·{" "}
                          {format(new Date(lead.created_at), "d MMM yyyy")}
                          {lead.source === "suggestion" ? " · via your suggestion" : null}
                        </div>
                        {lead.message ? (
                          <p className="rounded-md bg-muted px-3 py-2 text-sm">
                            &ldquo;{lead.message}&rdquo;
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>What&apos;s next</CardTitle>
            <CardDescription>The platform ships MVP by MVP.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <NextItem done>MVP1 — Phone-verified identity &amp; tenant intent</NextItem>
              <NextItem done>
                MVP2 — Verified listings: availability, last-verified, full cost breakdown
              </NextItem>
              <NextItem>MVP3 — Update history &amp; mismatch warnings</NextItem>
              <NextItem>MVP4 — Broker suggestions via in-app cards</NextItem>
              <NextItem>MVP5 — Admin panel</NextItem>
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

/**
 * What someone is looking for. Rendered for a tenant always, and for anyone
 * else once they have actually set one (0024).
 */
function IntentCard({ intent }: { intent: TenantIntent | null }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Home className="size-5 text-primary" />
            <CardTitle>Your rental intent</CardTitle>
          </div>
          <Button asChild size="sm" variant={intent ? "outline" : "default"}>
            <Link href="/intent">{intent ? "Edit" : "Set it up"}</Link>
          </Button>
        </div>
        <CardDescription>
          This is what owners and brokers can see (never your contact details).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {intent ? (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            <Field label="Budget">
              {formatINR(intent.budget_min)} – {formatINR(intent.budget_max)}
            </Field>
            <Field label="Configuration">{labelFor(BHK_OPTIONS, intent.bhk)}</Field>
            <Field label="Move-in by">
              {format(new Date(intent.move_in_date), "d MMM yyyy")}
            </Field>
            <Field label="Furnishing">
              {labelFor(FURNISHING_OPTIONS, intent.furnishing)}
            </Field>
            <Field label="Occupancy">
              {labelFor(OCCUPANCY_OPTIONS, intent.occupancy)}
            </Field>
            <Field label="Status">
              <Badge variant="success" className="capitalize">
                {intent.status}
              </Badge>
            </Field>
            {intent.notes ? (
              <div className="col-span-full">
                <Field label="Notes">{intent.notes}</Field>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">
            No intent on file yet. Brokers can only suggest listings to people who
            have told them what they want.
          </p>
        )}

        {intent ? (
          <form action={setIntentStatus} className="mt-4 flex items-center gap-2 border-t pt-4">
            <input
              type="hidden"
              name="status"
              value={intent.status === "active" ? "fulfilled" : "active"}
            />
            <Button type="submit" size="sm" variant="ghost">
              {intent.status === "active"
                ? "I've found a place — stop suggestions"
                : "Start looking again"}
            </Button>
            <span className="text-xs text-muted-foreground">
              {intent.status === "active"
                ? "Brokers can see this right now."
                : "Hidden from brokers until you resume."}
            </span>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Counts only — never who. A shortlist is private, and 0011 keeps it that way. */
function Engagement({ stats }: { stats?: { saves: number; enquiries: number; visits_answered: number } }) {
  if (!stats || (stats.saves === 0 && stats.enquiries === 0)) {
    return (
      <p className="mt-0.5 text-xs text-muted-foreground">
        No saves or enquiries yet.
      </p>
    );
  }

  return (
    <p className="mt-0.5 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{stats.saves}</span> saved ·{" "}
      <span className="font-medium text-foreground">{stats.enquiries}</span> asked for your
      number
      {stats.visits_answered > 0 ? (
        <>
          {" "}· <span className="font-medium text-foreground">{stats.visits_answered}</span>{" "}
          reported back after visiting
        </>
      ) : null}
    </p>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{children}</dd>
    </div>
  );
}

function NextItem({ children, done }: { children: React.ReactNode; done?: boolean }) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={
          done
            ? "inline-flex size-4 items-center justify-center rounded-full bg-success text-[10px] text-success-foreground"
            : "inline-block size-4 rounded-full border"
        }
      >
        {done ? "✓" : ""}
      </span>
      <span className={done ? "" : "text-muted-foreground"}>{children}</span>
    </li>
  );
}
