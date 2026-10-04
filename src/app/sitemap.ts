import type { MetadataRoute } from "next";
import { getDataClient } from "@/lib/auth";
import { getAreas } from "@/lib/areas";

const TOP_PUNE_AREAS = [
  "wakad",
  "baner",
  "hinjewadi",
  "kharadi",
  "kothrud",
  "viman-nagar",
  "aundh",
  "balewadi",
  "hadapsar",
  "koregaon-park",
  "magarpatta",
  "pimple-saudagar",
  "bavdhan",
  "punawale",
  "ravet",
  "wagholi",
  "kondhwa",
  "kalyani-nagar",
  "shivajinagar",
  "deccan",
];

const BHK_FACETS = ["1-bhk", "2-bhk", "3-bhk"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.kirayah.xyz";

  const entries: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/listings`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/direct`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  try {
    const supabase = await getDataClient();
    const [areas, { data: properties }] = await Promise.all([
      getAreas(supabase),
      supabase
        .from("properties")
        .select("id, updated_at, last_verified_at, created_at")
        .eq("status", "live"),
    ]);

    // 1. Locality Hubs (/rent/pune/[area])
    const activeAreas = areas.length > 0 ? areas : TOP_PUNE_AREAS.map((slug) => ({ slug }));
    for (const area of activeAreas) {
      entries.push({
        url: `${baseUrl}/rent/pune/${area.slug}`,
        lastModified: new Date(),
        changeFrequency: "daily",
        priority: 0.9,
      });

      // 2. High-Intent Facets (/rent/pune/[area]/[1-bhk|2-bhk|3-bhk])
      for (const bhk of BHK_FACETS) {
        entries.push({
          url: `${baseUrl}/rent/pune/${area.slug}/${bhk}`,
          lastModified: new Date(),
          changeFrequency: "daily",
          priority: 0.8,
        });
      }
    }

    // 3. Live Verified Listing Detail Pages (/listings/[id])
    if (properties && properties.length > 0) {
      for (const prop of properties) {
        const lastMod = prop.last_verified_at || prop.updated_at || prop.created_at;
        entries.push({
          url: `${baseUrl}/listings/${prop.id}`,
          lastModified: lastMod ? new Date(lastMod) : new Date(),
          changeFrequency: "hourly",
          priority: 0.85,
        });
      }
    }
  } catch (err) {
    console.error("[Sitemap] Error building dynamic entries:", err);
  }

  return entries;
}

