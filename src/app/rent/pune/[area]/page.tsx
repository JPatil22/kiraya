import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, ChevronRight, Home, MapPin, ShieldCheck, Sparkles, TrendingUp, Wallet } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { ListingCard } from "@/components/listings/listing-card";
import { LocalityFaq } from "@/components/seo/locality-faq";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDataClient, getSessionUser } from "@/lib/auth";
import { getCachedPublicListings } from "@/lib/listings";
import { getLocalityInsights } from "@/lib/locality-insights";
import { getShortlistIds } from "@/lib/shortlist";
import { formatINR } from "@/lib/utils";
import { listingFilterSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ area: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { area } = await params;
  const supabase = await getDataClient();
  const stats = await getLocalityInsights(supabase, area);

  if (!stats) {
    return {
      title: "Pune Rentals | Kiraya",
    };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.kirayah.xyz";
  const canonicalUrl = `${siteUrl}/rent/pune/${area}`;
  const title = `Verified Flats for Rent in ${stats.areaName}, Pune — Zero Brokerage | Kiraya`;
  const description = `Find verified 1 BHK, 2 BHK, and 3 BHK flats for rent in ${stats.areaName}, Pune. Avg rent: ${formatINR(stats.avgRent)}/mo. 100% itemized costs, ₹0 brokerage, and verified physical availability.`;

  return {
    title,
    description,
    keywords: [
      `flats for rent in ${stats.areaName} pune`,
      `flats for rent in ${stats.areaName}`,
      `apartments for rent ${stats.areaName}`,
      `zero brokerage flats ${stats.areaName}`,
      `1 bhk for rent in ${stats.areaName}`,
      `2 bhk for rent in ${stats.areaName}`,
      `3 bhk for rent in ${stats.areaName}`,
      "verified flats pune",
      "kiraya rentals",
    ],
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: "website",
      locale: "en_IN",
      siteName: "Kiraya",
      images: [
        {
          url: `${siteUrl}/api/og?title=${encodeURIComponent(title)}&area=${encodeURIComponent(stats.areaName)}&rent=${encodeURIComponent(formatINR(stats.avgRent))}`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [
        `${siteUrl}/api/og?title=${encodeURIComponent(title)}&area=${encodeURIComponent(stats.areaName)}&rent=${encodeURIComponent(formatINR(stats.avgRent))}`,
      ],
    },
    alternates: {
      canonical: canonicalUrl,
    },
  };
}

export default async function LocalityHubPage({ params }: PageProps) {
  const { area } = await params;
  const supabase = await getDataClient();
  const stats = await getLocalityInsights(supabase, area);

  if (!stats) notFound();

  const filters = listingFilterSchema.parse({
    area: stats.areaSlug,
  });

  const [feedResult, user] = await Promise.all([
    getCachedPublicListings(supabase, filters),
    getSessionUser(supabase),
  ]);

  const savedIds = user ? await getShortlistIds(supabase, user.id) : null;
  const listings = feedResult.listings;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.kirayah.xyz";

  // Schema.org BreadcrumbList
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: siteUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Pune Rentals",
        item: `${siteUrl}/listings`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: `${stats.areaName} Flats`,
        item: `${siteUrl}/rent/pune/${stats.areaSlug}`,
      },
    ],
  };

  // Schema.org FAQPage for Generative AI Q&A optimization
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `What is the average rent for flats in ${stats.areaName}, Pune?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `The average monthly rent for flats in ${stats.areaName} is approximately ${formatINR(stats.avgRent)}, with prices ranging between ${formatINR(stats.minRent)} and ${formatINR(stats.maxRent)} depending on BHK size and furnishing.`,
        },
      },
      {
        "@type": "Question",
        name: `Are there zero brokerage rental flats in ${stats.areaName}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `Yes, Kiraya lists direct owner rental properties in ${stats.areaName} with zero brokerage fees, 100% itemized pricing transparency, and verified physical details.`,
        },
      },
      {
        "@type": "Question",
        name: `What is the typical security deposit for a flat in ${stats.areaName}?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `The median security deposit for rental flats in ${stats.areaName} is approximately ${formatINR(stats.avgDeposit)}, typically equivalent to 2 to 3 months of monthly rent.`,
        },
      },
    ],
  };

  // Schema.org ItemList for catalog indexability
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Flats for Rent in ${stats.areaName}, Pune`,
    numberOfItems: listings.length,
    itemListElement: listings.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.title,
      url: `${siteUrl}/listings/${item.id}`,
    })),
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />

      {/* Ambient background decoration */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-dot-grid opacity-40 dark:opacity-20 [mask-image:radial-gradient(ellipse_70%_50%_at_50%_0%,#000_65%,transparent_100%)]"
      />

      <SiteHeader />

      <main className="relative mx-auto max-w-6xl space-y-8 px-4 sm:px-6 pt-6 pb-20">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors flex items-center gap-1">
            <Home className="size-3.5" /> Home
          </Link>
          <ChevronRight className="size-3.5 text-muted-foreground/60" />
          <Link href="/listings" className="hover:text-foreground transition-colors">
            Pune
          </Link>
          <ChevronRight className="size-3.5 text-muted-foreground/60" />
          <span className="font-semibold text-foreground">{stats.areaName}</span>
        </nav>

        {/* Locality Hero Banner */}
        <section className="rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card/90 to-background p-6 sm:p-10 shadow-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 -mr-16 -mt-16 size-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

          <div className="relative max-w-3xl space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold text-xs gap-1">
                <ShieldCheck className="size-3" />
                Zero Brokerage Hub
              </Badge>
              {stats.zone ? (
                <Badge variant="secondary" className="text-xs font-medium">
                  {stats.zone} Pune
                </Badge>
              ) : null}
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
              Flats for Rent in {stats.areaName}, Pune
            </h1>

            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              Browse authentic verified 1, 2, and 3 BHK rental flats in {stats.areaName}. Every listing features 100% itemized pricing, confirmed freshness timestamps, and direct owner contacts with zero brokerage.
            </p>
          </div>

          {/* Local Intelligence KPIs */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 border-t border-border/60 pt-6">
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                <TrendingUp className="size-3.5 text-primary" />
                <span>Avg Monthly Rent</span>
              </div>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-foreground">
                {formatINR(stats.avgRent)}
                <span className="text-xs font-normal text-muted-foreground">/mo</span>
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Range: {formatINR(stats.minRent)} - {formatINR(stats.maxRent)}
              </p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                <Wallet className="size-3.5 text-primary" />
                <span>Median Deposit</span>
              </div>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-foreground">
                {formatINR(stats.avgDeposit)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                ~2 to 3 months rent norm
              </p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                <Building2 className="size-3.5 text-primary" />
                <span>Active Listings</span>
              </div>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-foreground">
                {stats.totalListings}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Freshly verified in {stats.areaName}
              </p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                <Sparkles className="size-3.5 text-emerald-500" />
                <span>Zero Brokerage</span>
              </div>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400">
                100%
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Direct owner transparency
              </p>
            </div>
          </div>
        </section>

        {/* Facet Navigation Tabs */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Filter by Flat Size in {stats.areaName}
            </h2>
            <Link
              href={`/listings?area=${stats.areaSlug}`}
              className="text-xs font-medium text-primary hover:underline"
            >
              Open all filters →
            </Link>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="default" className="font-medium text-xs">
              <Link href={`/rent/pune/${stats.areaSlug}`}>
                All Flats ({stats.totalListings})
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="font-medium text-xs">
              <Link href={`/rent/pune/${stats.areaSlug}/1-bhk`}>
                1 BHK in {stats.areaName}
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="font-medium text-xs">
              <Link href={`/rent/pune/${stats.areaSlug}/2-bhk`}>
                2 BHK in {stats.areaName}
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="font-medium text-xs">
              <Link href={`/rent/pune/${stats.areaSlug}/3-bhk`}>
                3 BHK in {stats.areaName}
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="font-medium text-xs">
              <Link href={`/rent/pune/${stats.areaSlug}/furnished`}>
                Furnished Flats
              </Link>
            </Button>
          </div>
        </section>

        {/* Listings Feed */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Available Flats in {stats.areaName}
            </h2>
            <span className="text-xs text-muted-foreground">
              {listings.length} {listings.length === 1 ? "home" : "homes"} available
            </span>
          </div>

          {listings.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {listings.map((item, idx) => (
                <ListingCard
                  key={item.id}
                  listing={item}
                  priority={idx === 0}
                  saved={savedIds ? savedIds.has(item.id) : undefined}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/80 bg-muted/10 p-10 text-center space-y-3">
              <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted/40 text-muted-foreground">
                <Building2 className="size-6" />
              </div>
              <h3 className="font-bold text-lg text-foreground">
                All flats in {stats.areaName} were rented recently!
              </h3>
              <p className="max-w-md mx-auto text-xs text-muted-foreground leading-relaxed">
                Zero-brokerage flats in {stats.areaName} rent out quickly. Check out adjacent neighborhoods below or browse the full Pune listings feed.
              </p>
              <div className="pt-2 flex justify-center gap-3">
                <Button asChild size="sm">
                  <Link href="/listings">Browse All Pune Flats</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/direct">Explore Flatmates</Link>
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Locality FAQs & AI Overview Snippet Guide */}
        <LocalityFaq
          areaName={stats.areaName}
          avgRent={stats.avgRent}
          minRent={stats.minRent}
          maxRent={stats.maxRent}
          avgDeposit={stats.avgDeposit}
          totalListings={stats.totalListings}
          zone={stats.zone}
        />

        {/* Adjacent Neighborhood Links (Internal Linking Silo) */}
        {stats.nearbyAreas.length > 0 ? (
          <section className="rounded-2xl border border-border/60 bg-muted/15 p-6 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <MapPin className="size-3.5 text-primary" />
              Nearby Neighborhoods in {stats.zone ? `${stats.zone} ` : ""}Pune
            </h3>
            <p className="text-xs text-muted-foreground">
              Compare rental prices and browse zero-brokerage flats in localities adjacent to {stats.areaName}:
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {stats.nearbyAreas.map((nearby) => (
                <Link
                  key={nearby.slug}
                  href={`/rent/pune/${nearby.slug}`}
                  className="rounded-lg border border-border/80 bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/50 hover:text-primary transition-colors shadow-2xs"
                >
                  Flats in {nearby.name} →
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
