import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Home, MapPin, ShieldCheck, Sparkles, TrendingUp, Wallet, Building2 } from "lucide-react";
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
import type { BhkType, FurnishingType } from "@/types/database";

export const dynamic = "force-dynamic";

interface FacetConfig {
  label: string;
  shortLabel: string;
  filterType: "bhk" | "furnishing";
  bhkValue?: BhkType;
  furnishingValue?: FurnishingType;
}

const SUPPORTED_FACETS: Record<string, FacetConfig> = {
  "1-bhk": { label: "1 BHK Flats", shortLabel: "1 BHK", filterType: "bhk", bhkValue: "1bhk" },
  "2-bhk": { label: "2 BHK Flats", shortLabel: "2 BHK", filterType: "bhk", bhkValue: "2bhk" },
  "3-bhk": { label: "3 BHK Flats", shortLabel: "3 BHK", filterType: "bhk", bhkValue: "3bhk" },
  "1-rk": { label: "1 RK Flats", shortLabel: "1 RK", filterType: "bhk", bhkValue: "1rk" },
  furnished: { label: "Fully Furnished Flats", shortLabel: "Furnished", filterType: "furnishing", furnishingValue: "full" },
  "semi-furnished": { label: "Semi-Furnished Flats", shortLabel: "Semi-Furnished", filterType: "furnishing", furnishingValue: "semi" },
  unfurnished: { label: "Unfurnished Flats", shortLabel: "Unfurnished", filterType: "furnishing", furnishingValue: "unfurnished" },
};

interface PageProps {
  params: Promise<{ area: string; facet: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { area, facet } = await params;
  const supabase = await getDataClient();
  const stats = await getLocalityInsights(supabase, area);

  if (!stats) return { title: "Pune Rentals | Kiraya" };

  const facetConfig = SUPPORTED_FACETS[facet.toLowerCase()];
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.kirayah.xyz";

  // Strict Canonicalization rules:
  // If supported high-intent facet -> Self-referencing canonical
  // If non-standard / 3+ filter combination -> Canonicalize back to base area hub!
  const isHighIntent = Boolean(facetConfig);
  const canonicalUrl = isHighIntent
    ? `${siteUrl}/rent/pune/${area}/${facet}`
    : `${siteUrl}/rent/pune/${area}`;

  const facetLabel = facetConfig ? facetConfig.label : facet.replace(/-/g, " ");
  const title = `${facetLabel} for Rent in ${stats.areaName}, Pune — Zero Brokerage | Kiraya`;
  const description = `Browse verified ${facetLabel.toLowerCase()} for rent in ${stats.areaName}, Pune. Real-time availability, ₹0 brokerage, and itemized deposits.`;

  return {
    title,
    description,
    robots: isHighIntent
      ? { index: true, follow: true }
      : { index: false, follow: true },
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: "website",
      locale: "en_IN",
      siteName: "Kiraya",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function LocalityFacetPage({ params }: PageProps) {
  const { area, facet } = await params;
  const supabase = await getDataClient();
  const stats = await getLocalityInsights(supabase, area);

  if (!stats) notFound();

  const facetConfig = SUPPORTED_FACETS[facet.toLowerCase()];
  const facetLabel = facetConfig ? facetConfig.label : facet.replace(/-/g, " ");

  const bhkFilter = facetConfig?.filterType === "bhk" ? facetConfig.bhkValue ?? "any" : "any";
  const furnishingFilter = facetConfig?.filterType === "furnishing" ? facetConfig.furnishingValue ?? "any" : "any";

  const filters = listingFilterSchema.parse({
    area: stats.areaSlug,
    bhk: bhkFilter,
    furnishing: furnishingFilter,
  });

  const [feedResult, user] = await Promise.all([
    getCachedPublicListings(supabase, filters),
    getSessionUser(supabase),
  ]);

  const savedIds = user ? await getShortlistIds(supabase, user.id) : null;
  const listings = feedResult.listings;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.kirayah.xyz";

  // BreadcrumbList Schema
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
        name: "Pune",
        item: `${siteUrl}/listings`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: `${stats.areaName} Flats`,
        item: `${siteUrl}/rent/pune/${stats.areaSlug}`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: facetLabel,
        item: `${siteUrl}/rent/pune/${stats.areaSlug}/${facet}`,
      },
    ],
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <SiteHeader />

      <main className="relative mx-auto max-w-6xl space-y-8 px-4 sm:px-6 pt-6 pb-20">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
          <Link href="/" className="hover:text-foreground transition-colors flex items-center gap-1">
            <Home className="size-3.5" /> Home
          </Link>
          <ChevronRight className="size-3.5 text-muted-foreground/60" />
          <Link href="/listings" className="hover:text-foreground transition-colors">
            Pune
          </Link>
          <ChevronRight className="size-3.5 text-muted-foreground/60" />
          <Link href={`/rent/pune/${stats.areaSlug}`} className="hover:text-foreground transition-colors">
            {stats.areaName}
          </Link>
          <ChevronRight className="size-3.5 text-muted-foreground/60" />
          <span className="font-semibold text-foreground">{facetLabel}</span>
        </nav>

        {/* Facet Hero Section */}
        <section className="rounded-3xl border border-border/80 bg-gradient-to-br from-card via-card/90 to-background p-6 sm:p-10 shadow-sm relative overflow-hidden">
          <div className="relative max-w-3xl space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold text-xs gap-1">
                <ShieldCheck className="size-3" />
                Zero Brokerage
              </Badge>
              <Badge variant="secondary" className="text-xs font-medium">
                {stats.areaName}, Pune
              </Badge>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
              {facetLabel} for Rent in {stats.areaName}, Pune
            </h1>

            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              Explore physically verified {facetLabel.toLowerCase()} in {stats.areaName}. Strictly zero brokerage, verified physical photos, and itemized move-in outlays.
            </p>
          </div>

          {/* Facet Selector Pills */}
          <div className="mt-8 pt-6 border-t border-border/60 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline" className="font-medium text-xs">
              <Link href={`/rent/pune/${stats.areaSlug}`}>
                All Flats in {stats.areaName}
              </Link>
            </Button>
            {Object.entries(SUPPORTED_FACETS).map(([key, item]) => {
              const isActive = key === facet.toLowerCase();
              return (
                <Button
                  key={key}
                  asChild
                  size="sm"
                  variant={isActive ? "default" : "outline"}
                  className="font-medium text-xs"
                >
                  <Link href={`/rent/pune/${stats.areaSlug}/${key}`}>
                    {item.shortLabel}
                  </Link>
                </Button>
              );
            })}
          </div>
        </section>

        {/* Listings Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Verified {facetLabel} in {stats.areaName}
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
                No {facetLabel.toLowerCase()} available in {stats.areaName} right now
              </h3>
              <p className="max-w-md mx-auto text-xs text-muted-foreground leading-relaxed">
                Check all available flats in {stats.areaName} or browse similar configurations in nearby neighborhoods.
              </p>
              <div className="pt-2 flex justify-center gap-3">
                <Button asChild size="sm">
                  <Link href={`/rent/pune/${stats.areaSlug}`}>View All in {stats.areaName}</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/listings">All Pune Flats</Link>
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

        {/* Nearby Neighborhoods Silo */}
        {stats.nearbyAreas.length > 0 ? (
          <section className="rounded-2xl border border-border/60 bg-muted/15 p-6 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <MapPin className="size-3.5 text-primary" />
              {facetLabel} in Nearby Pune Localities
            </h3>
            <div className="flex flex-wrap gap-2 pt-1">
              {stats.nearbyAreas.map((nearby) => (
                <Link
                  key={nearby.slug}
                  href={`/rent/pune/${nearby.slug}/${facet}`}
                  className="rounded-lg border border-border/80 bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/50 hover:text-primary transition-colors shadow-2xs"
                >
                  {facetConfig?.shortLabel ?? facetLabel} in {nearby.name} →
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
