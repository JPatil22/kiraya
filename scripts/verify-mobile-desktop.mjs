import { chromium, devices } from "@playwright/test";
import fs from "node:fs";

async function verify() {
  const browser = await chromium.launch();

  console.log("🖥️ Testing Desktop Viewport (1440x900)...");
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const desktopPage = await desktopContext.newPage();

  // Test 1: Desktop Listings Page
  await desktopPage.goto("http://localhost:3000/listings", { waitUntil: "networkidle" });
  await desktopPage.screenshot({ path: "docs/desktop-listings.png", fullPage: false });

  const desktopCards = await desktopPage.$$eval(".grid > div", (els) => els.length);
  const desktopCols = await desktopPage.$eval(".grid", (el) => window.getComputedStyle(el).gridTemplateColumns.split(" ").length);
  const desktopOverflow = await desktopPage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  
  // Inspect first image on desktop
  const desktopImg = await desktopPage.$eval(".grid img", (img) => ({
    src: img.src,
    currentSrc: img.currentSrc,
    loading: img.loading,
    naturalWidth: img.naturalWidth,
    naturalHeight: img.naturalHeight,
    width: img.clientWidth,
    height: img.clientHeight,
  }));

  console.log("Desktop Results:", {
    cards: desktopCards,
    columns: desktopCols,
    hasHorizontalOverflow: desktopOverflow,
    firstImageWidth: desktopImg.width,
    firstImageHeight: desktopImg.height,
  });

  // Test 2: Mobile Viewport (iPhone 14: 390x844)
  console.log("\n📱 Testing Mobile Viewport (iPhone 14 - 390x844)...");
  const mobileContext = await browser.newContext({
    ...devices["iPhone 14"],
  });
  const mobilePage = await mobileContext.newPage();

  await mobilePage.goto("http://localhost:3000/listings", { waitUntil: "networkidle" });
  await mobilePage.screenshot({ path: "docs/mobile-listings.png", fullPage: false });

  const mobileCols = await mobilePage.$eval(".grid", (el) => window.getComputedStyle(el).gridTemplateColumns.split(" ").length);
  const mobileOverflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

  const mobileImg = await mobilePage.$eval(".grid img", (img) => ({
    src: img.src,
    currentSrc: img.currentSrc,
    loading: img.loading,
    naturalWidth: img.naturalWidth,
    naturalHeight: img.naturalHeight,
    width: img.clientWidth,
    height: img.clientHeight,
  }));

  console.log("Mobile Results:", {
    columns: mobileCols,
    hasHorizontalOverflow: mobileOverflow,
    firstImageWidth: mobileImg.width,
    firstImageHeight: mobileImg.height,
  });

  // Test 3: Locality Hub on Mobile
  await mobilePage.goto("http://localhost:3000/rent/pune/wakad", { waitUntil: "networkidle" });
  await mobilePage.screenshot({ path: "docs/mobile-wakad.png", fullPage: false });
  const wakadOverflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  console.log("Mobile Wakad Hub Overflow:", wakadOverflow);

  await browser.close();
  console.log("\n✨ Verification screenshots saved to docs/desktop-listings.png and docs/mobile-listings.png");
}

verify().catch(console.error);
