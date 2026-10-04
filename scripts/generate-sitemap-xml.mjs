import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

async function generate() {
  const env = fs.readFileSync(".env.local", "utf8");
  const getEnv = (k) => {
    const match = env.match(new RegExp("^" + k + "=(.*)$", "m"));
    return match ? match[1].trim() : null;
  };

  const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseKey = getEnv("SUPABASE_SERVICE_ROLE_KEY") || getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const supabase = createClient(supabaseUrl, supabaseKey);

  const baseUrl = "https://www.kirayah.xyz";

  const [areasRes, propsRes] = await Promise.all([
    supabase.from("areas").select("slug, name"),
    supabase.from("properties").select("id, updated_at, last_verified_at, created_at").eq("status", "live"),
  ]);

  const areas = areasRes.data || [];
  const properties = propsRes.data || [];

  const now = new Date().toISOString();

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];

  const addUrl = (loc, lastmod, freq, priority) => {
    lines.push("  <url>");
    lines.push(`    <loc>${loc}</loc>`);
    lines.push(`    <lastmod>${lastmod}</lastmod>`);
    lines.push(`    <changefreq>${freq}</changefreq>`);
    lines.push(`    <priority>${priority}</priority>`);
    lines.push("  </url>");
  };

  addUrl(baseUrl, now, "daily", "1.0");
  addUrl(`${baseUrl}/listings`, now, "hourly", "0.9");
  addUrl(`${baseUrl}/direct`, now, "daily", "0.9");

  for (const a of areas) {
    addUrl(`${baseUrl}/rent/pune/${a.slug}`, now, "daily", "0.9");
    addUrl(`${baseUrl}/rent/pune/${a.slug}/1-bhk`, now, "daily", "0.8");
    addUrl(`${baseUrl}/rent/pune/${a.slug}/2-bhk`, now, "daily", "0.8");
    addUrl(`${baseUrl}/rent/pune/${a.slug}/3-bhk`, now, "daily", "0.8");
  }

  for (const p of properties) {
    const lm = p.last_verified_at || p.updated_at || p.created_at || now;
    addUrl(`${baseUrl}/listings/${p.id}`, new Date(lm).toISOString(), "hourly", "0.85");
  }

  lines.push("</urlset>");

  if (!fs.existsSync("docs")) fs.mkdirSync("docs");
  fs.writeFileSync("docs/sitemap.xml", lines.join("\n"), "utf8");
  console.log(`Saved docs/sitemap.xml with ${3 + areas.length * 4 + properties.length} URLs successfully!`);
}

generate();
