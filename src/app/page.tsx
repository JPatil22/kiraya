import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  Camera,
  History,
  PhoneCall,
  ReceiptText,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ACTIVE_LOCALITY_SLUG } from "@/lib/locality";
import { OPEN_MODE } from "@/lib/open-mode";

/**
 * The shopfront. Everything claimed here is enforced somewhere in the schema —
 * the brokerage rule by a trigger (0023), freshness by a nightly sweep (0025),
 * the change log by the trigger that writes it (0003). If a claim on this page
 * stops being true, the fix is upstream of this file.
 */

const PILLARS = [
  {
    icon: CalendarClock,
    title: "Confirmed on a date",
    body: "Every listing carries the day someone last confirmed it, and goes stale on its own. Owners get chased before that happens, so what you see has usually been checked this week.",
  },
  {
    icon: ReceiptText,
    title: "The whole cost, itemised",
    body: "Rent, maintenance, deposit and one-time charges as separate numbers, with the monthly and move-in totals worked out. No single blurred price.",
  },
  {
    icon: BadgeCheck,
    title: "Brokerage, said out loud",
    body: "A broker has to state their fee before a listing goes live — zero is allowed, silence isn't. An owner listing cannot carry one at all, so “no brokerage” is a claim, not an empty field.",
  },
  {
    icon: History,
    title: "Every change on the record",
    body: "Price and availability edits are written to a public timeline by the database itself, not by whoever posted the listing. Two mismatch reports put a warning on the page.",
  },
];

const TENANT_STEPS = [
  {
    icon: Search,
    title: "Search by area and all-in budget",
    body: "Filter on what you actually pay each month, hide anything stale, and see how a listing compares to the median for its area.",
  },
  {
    icon: Camera,
    title: "See the rooms, or see that you can't",
    body: "Photos are filed by room, and a listing that only shows the hall says so — “3 of 5 rooms shown”, and which ones are missing.",
  },
  {
    icon: PhoneCall,
    title: "Numbers swap only when you ask",
    body: "Tell us what you're after and brokers can suggest listings without ever seeing your number. Unlock it when something is worth a call, book the viewing here, and tell us afterwards whether it matched.",
  },
];

const localityName = ACTIVE_LOCALITY_SLUG.split("-")
  .map((w) => w[0]?.toUpperCase() + w.slice(1))
  .join(" ");

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { code, error_description: oauthError, error: oauthErrorCode } = await searchParams;

  /**
   * Supabase reports OAuth failures against its Site URL too, so an error can
   * land here just as a code can. Showing the marketing page with the reason
   * hidden in the address bar tells nobody anything.
   */
  const failure = oauthError ?? oauthErrorCode;
  if (typeof failure === "string" && failure) {
    redirect(`/login?error=${encodeURIComponent(failure.replace(/\+/g, " "))}`);
  }

  /**
   * An OAuth code arriving here rather than at /auth/callback means Supabase
   * fell back to its Site URL — which it does whenever the requested redirect
   * is not on the allow list. The configuration is still wrong and should be
   * fixed, but dropping the user on a marketing page holding a valid code, with
   * no indication anything happened, is the worst of both. Hand it to the
   * callback, which is the only place that knows how to exchange it.
   */
  if (typeof code === "string" && code) {
    redirect(`/auth/callback?code=${encodeURIComponent(code)}`);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-6">
      <header className="flex items-center justify-between py-6">
        <span className="text-lg font-bold tracking-tight">
          किराया <span className="text-muted-foreground">Kiraya</span>
        </span>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/listings">Listings</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href={OPEN_MODE ? "/dashboard" : "/login"}>
              {OPEN_MODE ? "Dashboard" : "Sign in"}
            </Link>
          </Button>
        </div>
      </header>

      <section className="py-12">
        <Badge variant="secondary" className="mb-4 w-fit">
          Now serving {localityName}
        </Badge>
        <h1 className="max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          Fewer listings. All of them true.
        </h1>
        <p className="mt-4 max-w-2xl text-pretty text-lg text-muted-foreground">
          Most rental sites compete on how many flats they can show you. Kiraya competes on
          whether the flat is still available, at the price it says, from the person it
          claims. One locality at a time.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button asChild size="lg">
            <Link href={OPEN_MODE ? "/listings" : "/login"}>
              {OPEN_MODE ? "Browse listings" : "Get started"} <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/dashboard">{OPEN_MODE ? "Open the sandbox" : "Dashboard"}</Link>
          </Button>
          <span className="text-sm text-muted-foreground">
            {OPEN_MODE
              ? "Open preview · no sign-in, switch roles from the header"
              : "One phone number, one code. No documents, ever."}
          </span>
        </div>
      </section>

      <section className="border-t py-12">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          What makes a listing true here
        </h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {PILLARS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border bg-card p-5">
              <Icon className="mb-3 size-6 text-primary" />
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t py-12">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          If you&apos;re looking for a place
        </h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          {TENANT_STEPS.map(({ icon: Icon, title, body }) => (
            <div key={title}>
              <Icon className="mb-3 size-5 text-primary" />
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t py-12">
        <div className="rounded-xl border bg-muted/40 p-6">
          <h2 className="font-semibold">Listing a flat?</h2>
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
            Posting takes about a minute. It goes live once we&apos;ve checked it, stamped
            with the date we did — and when that date is about to go stale, we tell you, so
            confirming is one tap rather than a listing quietly dying. You see how many
            people saved it and asked for your number, never who they are.
          </p>
          <Button asChild size="sm" className="mt-4">
            <Link href={OPEN_MODE ? "/listings/new" : "/login"}>Post a property</Link>
          </Button>
        </div>
      </section>

      <footer className="mt-auto border-t py-6 text-sm text-muted-foreground">
        Built for {localityName} — phone-verified people, dated listings, itemised costs.
      </footer>
    </main>
  );
}
