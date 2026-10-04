import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const SVG_CONTENT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4F46E5"/>
      <stop offset="100%" stop-color="#3730A3"/>
    </linearGradient>
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#818CF8" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#312E81" stop-opacity="0.8"/>
    </linearGradient>
  </defs>
  <!-- Background squircle -->
  <rect x="8" y="8" width="496" height="496" rx="116" fill="url(#bg)" stroke="url(#borderGrad)" stroke-width="12"/>
  <!-- Devanagari Ki Mark -->
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
        fill="#FFFFFF" font-family="'Nirmala UI', 'Mangal', 'Segoe UI', -apple-system, sans-serif"
        font-weight="800" font-size="250"
        style="text-shadow: 0 4px 12px rgba(15, 23, 42, 0.35);">कि</text>
</svg>`;

/** Pack PNG buffers into a multi-resolution ICO file */
function createIco(images) {
  // images: array of { width, height, buffer }
  const headerSize = 6;
  const dirEntrySize = 16;
  const numImages = images.length;
  const dirSize = headerSize + dirEntrySize * numImages;

  let totalSize = dirSize;
  for (const img of images) {
    totalSize += img.buffer.length;
  }

  const out = Buffer.alloc(totalSize);

  // ICONDIR Header
  out.writeUInt16LE(0, 0); // Reserved
  out.writeUInt16LE(1, 2); // 1 = ICO
  out.writeUInt16LE(numImages, 4); // Number of images

  let currentOffset = dirSize;

  for (let i = 0; i < numImages; i++) {
    const img = images[i];
    const entryOffset = headerSize + i * dirEntrySize;

    out.writeUInt8(img.width === 256 ? 0 : img.width, entryOffset); // Width (0 = 256)
    out.writeUInt8(img.height === 256 ? 0 : img.height, entryOffset + 1); // Height (0 = 256)
    out.writeUInt8(0, entryOffset + 2); // Palette count
    out.writeUInt8(0, entryOffset + 3); // Reserved
    out.writeUInt16LE(1, entryOffset + 4); // Color planes
    out.writeUInt16LE(32, entryOffset + 6); // Bits per pixel
    out.writeUInt32LE(img.buffer.length, entryOffset + 8); // Size in bytes
    out.writeUInt32LE(currentOffset, entryOffset + 12); // File offset

    img.buffer.copy(out, currentOffset);
    currentOffset += img.buffer.length;
  }

  return out;
}

async function generate() {
  console.log("🎨 Launching browser to render pixel-perfect favicons...");
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Save the SVG directly
  fs.writeFileSync("public/icon.svg", SVG_CONTENT, "utf-8");
  console.log("✅ Wrote public/icon.svg");

  const sizes = [
    { name: "favicon-16x16.png", width: 16, height: 16 },
    { name: "favicon-32x32.png", width: 32, height: 32 },
    { name: "favicon-48x48.png", width: 48, height: 48 }, // Google Search requirement
    { name: "favicon-96x96.png", width: 96, height: 96 }, // Google Search High DPI
    { name: "apple-touch-icon.png", width: 180, height: 180 }, // iOS Safari
    { name: "web-app-manifest-192x192.png", width: 192, height: 192 }, // Android PWA
    { name: "web-app-manifest-512x512.png", width: 512, height: 512 }, // Android PWA Splash
  ];

  const icoBuffers = [];

  for (const s of sizes) {
    await page.setViewportSize({ width: s.width, height: s.height });
    await page.setContent(`<!DOCTYPE html>
      <html>
        <head>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { background: transparent; width: ${s.width}px; height: ${s.height}px; display: flex; overflow: hidden; }
            svg { width: 100%; height: 100%; }
          </style>
        </head>
        <body>${SVG_CONTENT}</body>
      </html>`);

    const el = await page.$("svg");
    const buf = await el.screenshot({ omitBackground: true });
    fs.writeFileSync(path.join("public", s.name), buf);
    console.log(`✅ Wrote public/${s.name} (${buf.length} bytes)`);

    if ([16, 32, 48].includes(s.width)) {
      icoBuffers.push({ width: s.width, height: s.height, buffer: buf });
    }
  }

  // Generate ICO containing 16x16, 32x32, 48x48
  const icoFile = createIco(icoBuffers);
  fs.writeFileSync("public/favicon.ico", icoFile);
  fs.writeFileSync("src/app/favicon.ico", icoFile);
  console.log(`✅ Wrote public/favicon.ico & src/app/favicon.ico (${icoFile.length} bytes)`);

  // Clean up scratch test file
  if (fs.existsSync("public/test-icon.png")) {
    fs.unlinkSync("public/test-icon.png");
  }

  await browser.close();
  console.log("🚀 All favicon & browser search assets generated successfully!");
}

generate().catch(console.error);
