import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  Camera,
  CheckCircle2,
  Clock,
  History,
  Lock,
  MapPin,
  PhoneCall,
  ReceiptText,
  Search,
  ShieldCheck,
  Sparkles,
  Building,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrandMark } from "@/components/brand-mark";
import { Reveal } from "@/components/reveal";
import { CountUp } from "@/components/count-up";
import { SiteHeader } from "@/components/site-header";
import { ACTIVE_LOCALITY_SLUG } from "@/lib/locality";
import { OPEN_MODE } from "@/lib/open-mode";

/**
 * The shopfront. Everything claimed here is enforced somewhere in the schema —
 * the brokerage rule by a trigger (0023), freshness by a nightly sweep (0025),
 * the change log by the trigger that writes it (0003).
 */

const PILLARS = [
  {
    icon: CalendarClock,
    title: "Confirmed on a date",
    body: "Every listing carries the day someone last confirmed it with the contact, keeping availability accurate and fresh so you never waste time on unavailable flats.",
    tag: "Fresh availability guaranteed",
  },
  {
    icon: ReceiptText,
    title: "The whole cost, itemised",
    body: "Rent, maintenance, deposit and one-time charges as separate numbers, with the monthly and move-in totals worked out. No single blurred price.",
    tag: "Zero hidden charges",
  },
  {
    icon: BadgeCheck,
    title: "Brokerage, said out loud",
    body: "A broker has to state their fee before a listing goes live — zero is allowed, silence isn't. An owner listing cannot carry one at all, so “no brokerage” is a claim, not an empty field.",
    tag: "Integrity enforced",
  },
  {
    icon: History,
    title: "Every change on the record",
    body: "Price and availability edits are written to a public timeline by the database itself, not by whoever posted the listing. Two mismatch reports put a warning on the page.",
    tag: "Tamper-proof audit",
  },
];

const TENANT_STEPS = [
  {
    step: "01",
    icon: Search,
    title: "Search by area & all-in budget",
    body: "Filter on what you actually pay each month, hide anything stale, and see how a listing compares to the median for its area.",
  },
  {
    step: "02",
    icon: Camera,
    title: "See the rooms, or see what's missing",
    body: "Photos are filed by room, and a listing that only shows the hall says so — “3 of 5 rooms shown”, and which ones are missing.",
  },
  {
    step: "03",
    icon: PhoneCall,
    title: "Numbers swap only when you ask",
    body: "Tell us what you're after and brokers can suggest listings without ever seeing your number. Unlock it when something is worth a call.",
  },
];

const PUNE_LOCALITIES = [
  { name: "Baner", range: "₹22k – ₹48k/mo", tag: "IT & Lifestyle", slug: "baner" },
  { name: "Koregaon Park", range: "₹28k – ₹70k/mo", tag: "Greenery & Cafes", slug: "koregaon-park" },
  { name: "Viman Nagar", range: "₹24k – ₹50k/mo", tag: "Airport & Tech", slug: "viman-nagar" },
  { name: "Kharadi", range: "₹20k – ₹42k/mo", tag: "EON Free Zone", slug: "kharadi" },
  { name: "Hinjewadi", range: "₹18k – ₹38k/mo", tag: "Tech Park Corridor", slug: "hinjewadi" },
  { name: "Kothrud", range: "₹19k – ₹40k/mo", tag: "Metro & Culture", slug: "kothrud" },
];

function CostRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1.5 text-sm">
      <span className={muted ? "text-muted-foreground" : "font-medium text-foreground"}>{label}</span>
      <span className="font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { code, error_description: oauthError, error: oauthErrorCode } = await searchParams;

  const failure = oauthError ?? oauthErrorCode;
  if (typeof failure === "string" && failure) {
    redirect(`/login?error=${encodeURIComponent(failure.replace(/\+/g, " "))}`);
  }

  if (typeof code === "string" && code) {
    redirect(`/auth/callback?code=${encodeURIComponent(code)}`);
  }

  const localityName = ACTIVE_LOCALITY_SLUG.split("-")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground antialiased selection:bg-primary/10">
      <noscript
        dangerouslySetInnerHTML={{
          __html: "<style>.reveal-up{opacity:1!important;transform:none!important}</style>",
        }}
      />

      {/* Shared Responsive Top Navbar */}
      <SiteHeader />

      {/* Hero Section — Editorial & Architectural */}
      <section className="relative overflow-hidden border-b border-border/70 bg-stone-50/50 dark:bg-stone-950/20">
        {/* Subtle Architectural Dot Grid */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-dot-grid opacity-35 dark:opacity-20 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,#000_60%,transparent_100%)]"
        />

        {/* Soft Natural Light Falloff — No Gimmicky Neon Auroras */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-40 h-80 bg-radial from-stone-200/40 via-stone-100/10 to-transparent dark:from-stone-800/20 dark:via-transparent blur-2xl"
        />

        <div className="relative mx-auto max-w-6xl px-6 pt-16 pb-20 sm:pt-24 sm:pb-28 text-center">
          {/* Architectural Registry Pill */}
          <div className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-stone-300/80 dark:border-stone-800 bg-stone-100/90 dark:bg-stone-900/90 px-3.5 py-1 text-xs text-stone-700 dark:text-stone-300 shadow-2xs backdrop-blur-sm">
            <span className="size-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
            <span className="font-semibold uppercase tracking-wider text-[11px] text-stone-500 dark:text-stone-400">
              Pune Rental Registry
            </span>
            <span className="text-stone-300 dark:text-stone-700">·</span>
            <span>Direct & verified flats</span>
          </div>

          {/* Solid Editorial Black Headline — No Neon Gradients */}
          <h1
            className="animate-fade-up mx-auto mt-7 max-w-4xl text-balance text-4xl font-extrabold tracking-tight text-stone-900 dark:text-stone-50 sm:text-6xl md:text-7xl"
            style={{ animationDelay: "90ms", lineHeight: 1.08 }}
          >
            Fewer listings.{" "}
            <span className="block text-stone-900 dark:text-stone-100">
              All of them true.
            </span>
          </h1>

          {/* Grounded Journalistic Subtitle */}
          <p
            className="animate-fade-up mx-auto mt-6 max-w-2xl text-pretty text-base sm:text-lg leading-relaxed text-stone-600 dark:text-stone-400 font-normal"
            style={{ animationDelay: "170ms" }}
          >
            No ghost listings, phantom pricing, or unstated broker fees. Every flat on Kiraya is physically verified, itemizes all deposits and charges, and guarantees real-time availability.
          </p>

          {/* Search-First Console */}
          <div className="animate-fade-up mx-auto mt-9 max-w-2xl" style={{ animationDelay: "250ms" }}>
            <form
              action="/listings"
              method="GET"
              className="flex flex-col sm:flex-row items-center gap-2 rounded-2xl border border-stone-300 dark:border-stone-800 bg-white dark:bg-stone-900 p-2 shadow-sm transition focus-within:border-stone-900 dark:focus-within:border-stone-100 focus-within:ring-1 focus-within:ring-stone-900/10"
            >
              <div className="relative flex flex-1 items-center w-full px-3">
                <Search className="size-4.5 text-stone-400 shrink-0" />
                <input
                  type="text"
                  name="q"
                  placeholder="Search by neighborhood, society, or BHK (e.g. Baner 2 BHK)..."
                  className="w-full bg-transparent px-3 py-2 text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none"
                />
              </div>
              <Button
                type="submit"
                size="default"
                className="w-full sm:w-auto h-10 px-5 bg-stone-900 hover:bg-stone-800 text-white dark:bg-stone-100 dark:hover:bg-stone-200 dark:text-stone-900 font-medium transition"
              >
                <span>Browse flats</span>
                <ArrowRight className="size-4 ml-1.5" />
              </Button>
            </form>

            {/* Quick Area Filter Pills */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
              <span className="font-medium mr-1 flex items-center gap-1">
                <MapPin className="size-3 text-stone-400" /> Active neighborhoods:
              </span>
              {PUNE_LOCALITIES.slice(0, 5).map((loc) => (
                <Link
                  key={loc.slug}
                  href={`/listings?area=${loc.slug}`}
                  className="rounded-md border border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-stone-900/80 px-2.5 py-1 text-stone-700 dark:text-stone-300 transition hover:border-stone-400 dark:hover:border-stone-600 hover:text-stone-900 dark:hover:text-stone-100 shadow-2xs"
                >
                  {loc.name}
                </Link>
              ))}
            </div>
          </div>

          {/* Kiraya Direct & Flatmates Portal Callout */}
          <div className="animate-fade-up mx-auto mt-7 max-w-xl" style={{ animationDelay: "340ms" }}>
            <Link
              href="/direct"
              className="group flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20 p-4 shadow-sm transition hover:border-emerald-500/60 hover:bg-emerald-500/10 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-600/20">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                      Kiraya Direct &amp; Flatmates
                    </span>
                    <span className="rounded-full bg-emerald-600/15 border border-emerald-600/30 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                      Strictly ₹0 Brokerage
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 dark:text-stone-300 mt-0.5">
                    Verified corporate professionals &amp; direct owners only. No brokers, no spam.
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform shrink-0">
                Explore Portal <ArrowRight className="size-3.5" />
              </span>
            </Link>
          </div>

          {/* Architectural Concrete Listing Showcase Card */}
          <div
            className="animate-fade-up mx-auto mt-10 max-w-lg"
            style={{ animationDelay: "420ms" }}
          >
            <div className="overflow-hidden rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 text-left shadow-md transition duration-200">
              {/* Photo Preview */}
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-stone-100 dark:bg-stone-800">
                <Image
                  src="/images/hero-apartment.jpg"
                  alt="Modern 2 BHK apartment in Baner Pune"
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, 512px"
                  className="object-cover"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

                {/* Top Badges */}
                <div className="absolute inset-x-3.5 top-3.5 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600/90 px-3 py-1 text-xs font-semibold text-white shadow-xs backdrop-blur-sm">
                    <CheckCircle2 className="size-3.5" />
                    Verified 2 days ago
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                    <Camera className="size-3" />
                    3 of 3 rooms shown
                  </span>
                </div>

                {/* Bottom Overlay Info */}
                <div className="absolute inset-x-3.5 bottom-3 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-white/80">Baner High Street, Pune</p>
                      <h3 className="text-xl font-bold tracking-tight">2 BHK Luxury · Semi-Furnished</h3>
                    </div>
                    <span className="rounded-md bg-white/20 px-2 py-0.5 text-xs font-medium backdrop-blur-sm">
                      Ready Now
                    </span>
                  </div>
                </div>
              </div>

              {/* Pricing & Itemized Breakdown */}
              <div className="p-6 sm:p-7">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2">
                    <CountUp to={28000} prefix="₹" className="text-3xl font-extrabold tracking-tight text-stone-900 dark:text-stone-100 tabular-nums" />
                    <span className="text-sm font-medium text-stone-500">/mo all-in</span>
                  </div>
                  <Badge variant="outline" className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                    Direct Owner · ₹0 Brokerage
                  </Badge>
                </div>

                <div className="mt-5 grid gap-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50/70 dark:bg-stone-800/40 p-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-stone-500">
                      Every Month
                    </p>
                    <CostRow label="Flat Rent" value="₹26,000" />
                    <CostRow label="Maintenance" value="₹2,000" muted />
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-stone-500">
                      Move-In Breakdown
                    </p>
                    <CostRow label="Security Deposit" value="₹50,000" muted />
                    <div className="flex items-baseline justify-between gap-2 py-1.5 text-sm">
                      <span className="text-stone-500">Brokerage</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">₹0 (Owner)</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-stone-500 pt-2 border-t border-stone-200 dark:border-stone-800">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="size-3.5 text-stone-700 dark:text-stone-300" /> Verified physical inventory
                  </span>
                  <Link href="/listings" className="font-medium text-stone-900 dark:text-stone-100 hover:underline flex items-center gap-0.5">
                    View in feed <ArrowRight className="size-3" />
                  </Link>
                </div>
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-stone-500">
              Guaranteed by database constraints — posters cannot inflate or conceal prices.
            </p>
          </div>
        </div>
      </section>

      {/* Trust & Truth Proof Strip */}
      <section className="border-b border-border/60 bg-muted/20 py-8">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Clock className="size-4.5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold">Fresh Availability</h4>
                <p className="text-xs text-muted-foreground">Listings actively confirmed to prevent ghost posts</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ReceiptText className="size-4.5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold">100% Itemized</h4>
                <p className="text-xs text-muted-foreground">Rent, maintenance, & deposits itemized up front</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ShieldCheck className="size-4.5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold">No Surprise Fees</h4>
                <p className="text-xs text-muted-foreground">Brokerage stated clearly or completely disallowed</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <History className="size-4.5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold">Public Audit Log</h4>
                <p className="text-xs text-muted-foreground">Every price adjustment and status change logged</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-6">
        {/* Why Kiraya - Bento Grid */}
        <section className="py-20">
          <Reveal className="mx-auto max-w-2xl text-center">
            <Badge variant="outline" className="border-primary/30 text-primary font-semibold text-xs uppercase tracking-wider mb-2">
              Platform Architecture
            </Badge>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              What makes a listing true here
            </h2>
            <p className="mt-3 text-muted-foreground">
              Most rental portals profit from fake inventory. Kiraya is engineered around cryptographic freshness and database truth.
            </p>
          </Reveal>

          <div className="mt-14 grid gap-5 sm:grid-cols-2">
            {PILLARS.map(({ icon: Icon, title, body, tag }, i) => (
              <Reveal key={title} delay={i * 90}>
                <div className="glass-card group h-full rounded-2xl p-7">
                  <div className="flex items-center justify-between">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition duration-300 group-hover:scale-105 group-hover:bg-primary group-hover:text-primary-foreground">
                      <Icon className="size-6" />
                    </div>
                    <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground">
                      {tag}
                    </span>
                  </div>
                  <h3 className="mt-5 text-xl font-bold tracking-tight">{title}</h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Pune Locality Explorer Strip */}
        <section className="border-t border-border/60 py-18">
          <Reveal className="mx-auto max-w-2xl text-center">
            <Badge variant="outline" className="border-primary/30 text-primary font-semibold text-xs uppercase tracking-wider mb-2">
              Neighborhood Intelligence
            </Badge>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Explore rentals across Pune
            </h2>
            <p className="mt-3 text-muted-foreground">
              Browse verified homes by locality with transparent rent ranges benchmarked to real data.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PUNE_LOCALITIES.map((loc, i) => (
              <Reveal key={loc.name} delay={i * 70}>
                <Link
                  href={`/listings?area=${loc.slug}`}
                  className="glass-card group block rounded-xl p-5 hover:border-primary/40"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building className="size-4 text-primary" />
                      <h3 className="font-bold text-base group-hover:text-primary transition-colors">
                        {loc.name}
                      </h3>
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">{loc.range}</span>
                    <span className="text-muted-foreground">{loc.tag}</span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Tenant Journey Steps */}
        <section className="border-t border-border/60 py-20">
          <Reveal className="mx-auto max-w-2xl text-center">
            <Badge variant="outline" className="border-primary/30 text-primary font-semibold text-xs uppercase tracking-wider mb-2">
              Tenant Experience
            </Badge>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Looking for your next home?
            </h2>
            <p className="mt-3 text-muted-foreground">
              No endless phone calls. No repeated brokerage arguments. Renting the way it should be.
            </p>
          </Reveal>

          <div className="mt-14 grid gap-8 sm:grid-cols-3">
            {TENANT_STEPS.map(({ step, icon: Icon, title, body }, i) => (
              <Reveal key={title} delay={i * 100}>
                <div className="relative rounded-2xl border border-border/70 bg-card p-6 shadow-sm transition hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xl font-extrabold text-primary">
                      {step}
                    </span>
                    <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-4.5" />
                    </div>
                  </div>
                  <h3 className="mt-4 font-bold tracking-tight text-lg">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Landlord & Owner High-Impact CTA */}
        <section className="pb-24">
          <Reveal className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-background p-8 sm:p-12 shadow-xl">
            <div className="absolute right-0 top-0 -mt-8 -mr-8 size-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-xl">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary mb-3">
                  <Sparkles className="size-3" />
                  For Property Owners
                </span>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  Listing your flat in Pune?
                </h2>
                <p className="mt-2 text-sm sm:text-base leading-relaxed text-muted-foreground">
                  Posting takes 60 seconds. Listings are verified before publishing. Never expose your personal phone number to unwanted telemarketers. Only verified tenants reach out when ready.
                </p>
              </div>
              <Button asChild size="lg" className="h-12 shrink-0 px-7 font-bold shadow-md shadow-primary/25">
                <Link href={OPEN_MODE ? "/listings/new" : "/login"}>
                  Post a Property <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            </div>
          </Reveal>
        </section>
      </main>

      {/* Modern Footer */}
      <footer className="border-t border-border/60 bg-muted/20">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <BrandMark />
              <p className="mt-2 text-xs text-muted-foreground">
                Dedicated to rental integrity in {localityName} · Phone-verified individuals, dated listings, itemised costs.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
              <Link href="/listings" className="hover:text-primary transition-colors">
                Listings
              </Link>
              <Link href="/dashboard" className="hover:text-primary transition-colors">
                Dashboard
              </Link>
              <Link href={OPEN_MODE ? "/listings/new" : "/login"} className="hover:text-primary transition-colors">
                Post Property
              </Link>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-border/40 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} Kiraya. All rights reserved. Built for truth.
          </div>
        </div>
      </footer>
    </div>
  );
}

