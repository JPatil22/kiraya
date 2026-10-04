import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getAreas } from "@/lib/areas";
import { ACTIVE_LOCALITY_SLUG } from "@/lib/locality";

export interface LocalityStats {
  areaName: string;
  areaSlug: string;
  zone: string | null;
  avgRent: number;
  minRent: number;
  maxRent: number;
  avgDeposit: number;
  totalListings: number;
  zeroBrokerageCount: number;
  nearbyAreas: { slug: string; name: string }[];
}

/** Fallback benchmark figures for Pune micro-markets when seed data is sparse */
const PUNE_AREA_BENCHMARKS: Record<string, { avgRent: number; avgDeposit: number }> = {
  wakad: { avgRent: 26000, avgDeposit: 55000 },
  baner: { avgRent: 28000, avgDeposit: 60000 },
  hinjewadi: { avgRent: 22000, avgDeposit: 45000 },
  kharadi: { avgRent: 27000, avgDeposit: 55000 },
  kothrud: { avgRent: 24000, avgDeposit: 50000 },
  "viman-nagar": { avgRent: 30000, avgDeposit: 65000 },
  aundh: { avgRent: 27000, avgDeposit: 55000 },
  balewadi: { avgRent: 26000, avgDeposit: 55000 },
  hadapsar: { avgRent: 20000, avgDeposit: 40000 },
  "koregaon-park": { avgRent: 42000, avgDeposit: 90000 },
  magarpatta: { avgRent: 25000, avgDeposit: 50000 },
  "pimple-saudagar": { avgRent: 24000, avgDeposit: 50000 },
  bavdhan: { avgRent: 23000, avgDeposit: 48000 },
  punawale: { avgRent: 20000, avgDeposit: 40000 },
  ravet: { avgRent: 19000, avgDeposit: 38000 },
  wagholi: { avgRent: 18000, avgDeposit: 35000 },
  kondhwa: { avgRent: 21000, avgDeposit: 42000 },
  "kalyani-nagar": { avgRent: 35000, avgDeposit: 75000 },
  shivajinagar: { avgRent: 28000, avgDeposit: 60000 },
  deccan: { avgRent: 26000, avgDeposit: 55000 },
};

export async function getLocalityInsights(
  supabase: SupabaseClient<Database>,
  areaSlug: string,
): Promise<LocalityStats | null> {
  const allAreas = await getAreas(supabase);
  const currentArea = allAreas.find(
    (a) => a.slug.toLowerCase() === areaSlug.toLowerCase(),
  );

  const areaName = currentArea
    ? currentArea.name
    : areaSlug
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

  // Fetch actual live listings in this area
  const { data: listings } = await supabase
    .from("v_listings_public")
    .select("all_in_monthly, rent, deposit, brokerage")
    .eq("locality_slug", ACTIVE_LOCALITY_SLUG)
    .eq("area_slug", areaSlug);

  const fallback = PUNE_AREA_BENCHMARKS[areaSlug.toLowerCase()] ?? {
    avgRent: 24000,
    avgDeposit: 50000,
  };

  let avgRent = fallback.avgRent;
  let minRent = Math.round(fallback.avgRent * 0.75);
  let maxRent = Math.round(fallback.avgRent * 1.4);
  let avgDeposit = fallback.avgDeposit;
  let totalListings = 0;
  let zeroBrokerageCount = 0;

  if (listings && listings.length > 0) {
    totalListings = listings.length;
    zeroBrokerageCount = listings.filter((l) => l.brokerage === 0).length;

    const rents = listings.map((l) => l.all_in_monthly || l.rent).filter(Boolean);
    const deposits = listings.map((l) => l.deposit).filter(Boolean);

    if (rents.length > 0) {
      minRent = Math.min(...rents);
      maxRent = Math.max(...rents);
      avgRent = Math.round(rents.reduce((acc, val) => acc + val, 0) / rents.length);
    }

    if (deposits.length > 0) {
      avgDeposit = Math.round(
        deposits.reduce((acc, val) => acc + val, 0) / deposits.length,
      );
    }
  }

  // Find nearby areas: first preference from same zone, else popular Pune hubs
  const zone = currentArea?.zone ?? null;
  const nearbyAreas = allAreas
    .filter((a) => a.slug.toLowerCase() !== areaSlug.toLowerCase())
    .filter((a) => (zone && a.zone === zone) || !zone)
    .slice(0, 6)
    .map((a) => ({ slug: a.slug, name: a.name }));

  // If zone has fewer than 3, backfill with top Pune areas
  if (nearbyAreas.length < 3) {
    const popular = ["wakad", "baner", "hinjewadi", "kharadi", "kothrud"];
    for (const popSlug of popular) {
      if (popSlug !== areaSlug && !nearbyAreas.some((n) => n.slug === popSlug)) {
        const found = allAreas.find((a) => a.slug === popSlug);
        if (found) nearbyAreas.push({ slug: found.slug, name: found.name });
      }
      if (nearbyAreas.length >= 5) break;
    }
  }

  return {
    areaName,
    areaSlug,
    zone,
    avgRent,
    minRent,
    maxRent,
    avgDeposit,
    totalListings,
    zeroBrokerageCount,
    nearbyAreas,
  };
}
