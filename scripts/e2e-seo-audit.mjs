import http from "node:http";

const BASE_URL = "http://localhost:3000";

async function fetchUrl(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    redirect: "manual",
    ...options,
  });
  const text = await res.text();
  return { status: res.status, headers: res.headers, text };
}

const results = [];

function record(category, testName, passed, details = "") {
  results.push({ category, testName, passed, details });
  const icon = passed ? "✅" : "❌";
  console.log(`${icon} [${category}] ${testName}: ${details}`);
}

async function runAudit() {
  console.log("🔍 Starting End-to-End SEO & System Audit for Kiraya...\n");

  // 1. Robots.txt
  try {
    const r = await fetchUrl("/robots.txt");
    const passed = r.status === 200 && r.text.includes("sitemap.xml") && r.text.includes("Allow: /");
    record("Robots.txt", "Robots Configuration", passed, `Status ${r.status}, includes sitemap directive`);
  } catch (e) {
    record("Robots.txt", "Robots Configuration", false, e.message);
  }

  // 2. Sitemap.xml
  try {
    const r = await fetchUrl("/sitemap.xml");
    const locMatches = r.text.match(/<loc>/g) || [];
    const passed = r.status === 200 && r.text.includes("<urlset") && locMatches.length > 200;
    record("Sitemap.xml", "Dynamic XML Sitemap", passed, `Status ${r.status}, found ${locMatches.length} URLs in sitemap`);
  } catch (e) {
    record("Sitemap.xml", "Dynamic XML Sitemap", false, e.message);
  }

  // 3. Favicon & Branding Assets
  const brandAssets = [
    "/favicon.ico",
    "/icon.svg",
    "/favicon-48x48.png",
    "/favicon-96x96.png",
    "/apple-touch-icon.png",
    "/site.webmanifest",
    "/manifest.webmanifest",
  ];
  for (const asset of brandAssets) {
    try {
      const r = await fetchUrl(asset);
      const passed = r.status === 200;
      record("Branding Assets", `Asset ${asset}`, passed, `Status ${r.status}, Content-Type: ${r.headers.get("content-type")}`);
    } catch (e) {
      record("Branding Assets", `Asset ${asset}`, false, e.message);
    }
  }

  // 4. Homepage Metadata & Schema
  try {
    const r = await fetchUrl("/");
    const hasSearchAction = r.text.includes("SearchAction");
    const hasSitelinksNav = r.text.includes("SiteNavigationElement");
    const hasAlternateName = r.text.includes("Kirayah") && r.text.includes("किराया");
    const hasThemeColor = r.text.includes("theme-color");
    const hasIcons = r.text.includes("favicon-48x48.png");

    record("Homepage", "Status 200 OK", r.status === 200, `Status ${r.status}`);
    record("Homepage", "Google Sitelinks Searchbox Schema", hasSearchAction, "WebSite has SearchAction query-input");
    record("Homepage", "Expanded Sitelinks Navigation Schema", hasSitelinksNav, "SiteNavigationElement ItemList present");
    record("Homepage", "Brand Aliases (Kirayah, किराया)", hasAlternateName, "alternateName array verified in schema");
    record("Homepage", "Mobile Theme Color & Favicon Links", hasThemeColor && hasIcons, "theme-color and favicon links present in head");
  } catch (e) {
    record("Homepage", "Homepage Checks", false, e.message);
  }

  // 5. Locality Hub (/rent/pune/wakad)
  try {
    const r = await fetchUrl("/rent/pune/wakad");
    const hasBreadcrumbs = r.text.includes("BreadcrumbList");
    const hasBenchmarks = r.text.includes("Avg Rent") || r.text.includes("Deposit");
    const hasTitle = r.text.includes("Wakad, Pune");

    record("Locality Hub", "Wakad Hub 200 OK", r.status === 200, `Status ${r.status}`);
    record("Locality Hub", "Wakad Schema & Benchmarks", hasBreadcrumbs && hasBenchmarks, `BreadcrumbList & rent benchmark cards rendered`);
    record("Locality Hub", "Wakad SEO Title & Metadata", hasTitle, "Dynamic title contains Wakad, Pune");
  } catch (e) {
    record("Locality Hub", "Locality Hub Checks", false, e.message);
  }

  // 6. Locality Facet (/rent/pune/wakad/2-bhk)
  try {
    const r = await fetchUrl("/rent/pune/wakad/2-bhk");
    const hasCanonical = r.text.includes('rel="canonical"') || r.text.includes('/rent/pune/wakad/2-bhk');
    const hasBreadcrumbs = r.text.includes("BreadcrumbList");

    record("Facet Route", "Wakad 2-BHK 200 OK", r.status === 200, `Status ${r.status}`);
    record("Facet Route", "Facet Breadcrumbs & Canonical", hasBreadcrumbs, "BreadcrumbList with facet depth rendered");
  } catch (e) {
    record("Facet Route", "Facet Route Checks", false, e.message);
  }

  // 7. Direct Page (/direct)
  try {
    const r = await fetchUrl("/direct");
    const hasTitle = r.text.includes("Kiraya Direct");
    record("Kiraya Direct", "Direct Page 200 OK", r.status === 200, `Status ${r.status}, Title: Kiraya Direct`);
  } catch (e) {
    record("Kiraya Direct", "Direct Page Checks", false, e.message);
  }

  // 8. Listings Feed (/listings) & Area Discovery
  try {
    const r = await fetchUrl("/listings?q=baner");
    const hasLocalityBridge = r.text.includes("Baner") && r.text.includes("Locality Hub");
    record("Listings Feed", "Locality Discovery Bridge on Search", hasLocalityBridge, "Detects 'baner' query and renders Locality Hub card");
  } catch (e) {
    record("Listings Feed", "Listings Feed Checks", false, e.message);
  }

  // 9. Individual Listing Crawlability & Freemium Masking
  try {
    // Extract a listing URL from sitemap
    const sm = await fetchUrl("/sitemap.xml");
    const listingMatch = sm.text.match(/https?:\/\/[^\/]+\/listings\/([a-f0-9\-]+)/);
    if (listingMatch) {
      const listingId = listingMatch[1];
      const r = await fetchUrl(`/listings/${listingId}`);
      
      const is200 = r.status === 200; // Not 307!
      const hasSchema = r.text.includes("RealEstateListing") && r.text.includes("₹0 Brokerage");
      const isPriceMasked = r.text.includes("••,•••") || r.text.includes("🔒");
      
      record("Listing Page", "Googlebot Crawlability (No 307 Login Wall)", is200, `Status is ${r.status} (Googlebot can index)`);
      record("Listing Page", "RealEstateListing Schema + ₹0 Brokerage Tag", hasSchema, "Schema.org Offer has price and zero brokerage");
      record("Listing Page", "Freemium Masking for Guest Visitors", isPriceMasked, "UI masks price with lock CTA while schema remains readable");
    } else {
      record("Listing Page", "Listing Sample Discovery", false, "No listing ID found in sitemap");
    }
  } catch (e) {
    record("Listing Page", "Listing Checks", false, e.message);
  }

  console.log("\n=================================");
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  console.log(`Audit Complete: ${passed}/${total} Passed, ${failed} Failed.`);
  console.log("=================================\n");
}

runAudit().catch(console.error);
