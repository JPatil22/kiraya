import Link from "next/link";
import { BadgeCheck, CalendarClock, ReceiptText, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ACTIVE_LOCALITY_SLUG } from "@/lib/locality";
import { OPEN_MODE } from "@/lib/open-mode";

const PILLARS = [
  {
    icon: BadgeCheck,
    title: "Verified tenants",
    body: "Everyone is phone-verified before they can act. No Aadhaar, no document uploads — just real people.",
  },
  {
    icon: CalendarClock,
    title: "Fresh availability",
    body: "Every listing shows when it was last verified and goes stale automatically. Stop calling dead listings.",
  },
  {
    icon: ReceiptText,
    title: "Transparent history",
    body: "Full cost breakdown, who posted it, and a log of every price and availability change.",
  },
];

const localityName = ACTIVE_LOCALITY_SLUG
  .split("-")
  .map((w) => w[0]?.toUpperCase() + w.slice(1))
  .join(" ");

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-6">
      <header className="flex items-center justify-between py-6">
        <span className="text-lg font-bold tracking-tight">
          किराया <span className="text-muted-foreground">Kiraya</span>
        </span>
        <Button asChild variant="ghost" size="sm">
          <Link href={OPEN_MODE ? "/dashboard" : "/login"}>
            {OPEN_MODE ? "Dashboard" : "Sign in"}
          </Link>
        </Button>
      </header>

      <section className="flex flex-1 flex-col justify-center py-12">
        <Badge variant="secondary" className="mb-4 w-fit">
          Now serving {localityName}
        </Badge>
        <h1 className="max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          Renting, without the stale listings and hidden costs.
        </h1>
        <p className="mt-4 max-w-2xl text-pretty text-lg text-muted-foreground">
          Kiraya is a tenant-first rental platform for one locality. We optimise for the
          truth of a listing — not the volume of listings.
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
              : "Phone OTP · takes 30 seconds"}
          </span>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          {PILLARS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border bg-card p-5">
              <Icon className="mb-3 size-6 text-primary" />
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t py-6 text-sm text-muted-foreground">
        MVP1 · Identity & Intent · MVP2 · Verified Listings. See{" "}
        <span className="font-medium text-foreground">docs/ROADMAP.md</span> for what ships next.
      </footer>
    </main>
  );
}
