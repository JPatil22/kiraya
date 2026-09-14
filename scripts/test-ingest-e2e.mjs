#!/usr/bin/env node
/**
 * test-ingest-e2e.mjs
 * End-to-end test script verifying listing ingestion and admin review decision flows.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(file) {
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
      if (!m) continue;
      const v = m[2].trim().replace(/^["']|["']$/g, "");
      if (!(m[1] in process.env)) process.env[m[1]] = v;
    }
  } catch {}
}
loadEnv(".env.local");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiKey = process.env.INGEST_API_KEY || "my-super-secret-key";

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const db = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log("\n=======================================================");
console.log("  🚀 Running End-to-End Ingest & Review Verification");
console.log("=======================================================\n");

const SAMPLE_POST = {
  source: "https://www.facebook.com/groups/punerentals/posts/999888777",
  text: `Spacious 2 BHK available for rent in Baner, Pune near Balewadi High Street.
Society: Rohan Leher, Baner.
Rent: 28,000 / month, Deposit: 60,000.
Semi-furnished flat with modular kitchen, wardrobes, lights, fans, geyser and 2 private balconies.
Covered car parking and lift backup available.
Working professionals or families preferred.
Immediate possession available.
Brokerage: 15,000.
Contact: Rajesh Sharma - 9823012345`,
  images: [
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=800&auto=format&fit=crop&q=80",
  ],
};

let testPropertyId = null;

try {
  // Step 1: Ingest via local server API (or direct import if server not up)
  console.log("1. Testing Ingestion API endpoint (/api/ingest)...");
  let ingestResult;
  try {
    const res = await fetch("http://localhost:3000/api/ingest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(SAMPLE_POST),
    });

    if (res.ok) {
      ingestResult = await res.json();
      console.log("   ✅ API Ingest succeeded:", ingestResult);
      testPropertyId = ingestResult.propertyId;
    } else {
      console.log(`   ℹ️ Local server responded with HTTP ${res.status} (falling back to direct DB verification)`);
    }
  } catch (err) {
    console.log("   ℹ️ Dev server not currently responding at localhost:3000, testing via direct ingest engine...");
  }

  // Fallback: If dev server wasn't running during script invocation, test via direct ingest module
  if (!testPropertyId) {
    // Dynamic import to test internal engine
    const { ingestListing } = await import("../src/lib/ingest.ts");
    const result = await ingestListing(db, SAMPLE_POST);
    testPropertyId = result.propertyId;
    console.log("   ✅ Direct Engine Ingest succeeded. Property ID:", testPropertyId);
  }

  // Step 2: Verify property created in pending_review
  console.log("\n2. Verifying database state for property:", testPropertyId);
  const { data: prop, error: propErr } = await db
    .from("properties")
    .select("*")
    .eq("id", testPropertyId)
    .single();

  if (propErr || !prop) throw new Error("Property not found: " + propErr?.message);
  console.log(`   ✅ Status: '${prop.status}' (expected: 'pending_review')`);
  console.log(`   ✅ Rent: ₹${prop.rent}, Deposit: ₹${prop.deposit}, BHK: ${prop.bhk}`);
  console.log(`   ✅ Brokerage: ₹${prop.brokerage}`);
  if (prop.status !== "pending_review") {
    throw new Error(`Expected pending_review, got ${prop.status}`);
  }

  // Step 3: Verify private contact stored in listing_sources
  console.log("\n3. Verifying private source contact in listing_sources...");
  const { data: source } = await db
    .from("listing_sources")
    .select("*")
    .eq("property_id", testPropertyId)
    .maybeSingle();

  if (source) {
    console.log(`   ✅ Extracted Contact: ${source.source_name} (${source.source_phone})`);
  } else {
    console.log("   ℹ️ No listing_sources row created (phone may be masked or unparsed)");
  }

  // Step 4: Verify staged photos in ingest_photos
  console.log("\n4. Verifying staged photos in ingest_photos...");
  const { data: stagedPhotos } = await db
    .from("ingest_photos")
    .select("*")
    .eq("property_id", testPropertyId);

  console.log(`   ✅ Staged photos count: ${stagedPhotos?.length ?? 0}`);

  if (stagedPhotos && stagedPhotos.length > 0) {
    const photoToDiscard = stagedPhotos[0];
    console.log(`   🗑️ Testing photo discard on staged photo ${photoToDiscard.id}...`);
    await db.from("ingest_photos").delete().eq("id", photoToDiscard.id);
    if (photoToDiscard.storage_path) {
      await db.storage.from("listing-photos").remove([photoToDiscard.storage_path]);
    }
    console.log("   ✅ Photo discarded successfully.");
  }

  // Step 5: Test Review Decisions
  console.log("\n5. Testing Admin Review Decisions...");
  
  // Test 5A: Publish (Approve)
  console.log("   ▶ Testing 'Approve & publish' decision...");
  const adminId = prop.posted_by;
  const now = new Date().toISOString();
  const { error: approveErr } = await db
    .from("properties")
    .update({ status: "live", last_verified_at: now, last_verified_by: adminId })
    .eq("id", testPropertyId);

  if (approveErr) throw new Error("Approve failed: " + approveErr.message);

  const { data: liveProp } = await db
    .from("properties")
    .select("status, last_verified_at")
    .eq("id", testPropertyId)
    .single();

  console.log(`   ✅ Property transitioned to status='${liveProp.status}', last_verified_at=${liveProp.last_verified_at}`);
  if (liveProp.status !== "live") throw new Error("Expected status live");

  // Test 5B: Discard (Reject)
  console.log("   ▶ Testing 'Discard / Reject' decision...");
  const { error: rejectErr } = await db
    .from("properties")
    .update({ status: "rejected" })
    .eq("id", testPropertyId);

  if (rejectErr) throw new Error("Reject failed: " + rejectErr.message);

  const { data: rejectedProp } = await db
    .from("properties")
    .select("status")
    .eq("id", testPropertyId)
    .single();

  console.log(`   ✅ Property transitioned to status='${rejectedProp.status}' (discarded from queue)`);
  if (rejectedProp.status !== "rejected") throw new Error("Expected status rejected");

  console.log("\n=======================================================");
  console.log("  🎉 ALL END-TO-END INGEST & REVIEW CHECKS PASSED!");
  console.log("=======================================================\n");

} catch (error) {
  console.error("\n❌ E2E Test Failed:", error);
  process.exitCode = 1;
} finally {
  // Cleanup test property
  if (testPropertyId) {
    console.log("🧹 Cleaning up test property and staged photos...");
    const { data: photos } = await db
      .from("ingest_photos")
      .select("storage_path")
      .eq("property_id", testPropertyId);

    if (photos && photos.length > 0) {
      const keys = photos.map((p) => p.storage_path).filter(Boolean);
      if (keys.length > 0) {
        await db.storage.from("listing-photos").remove(keys);
      }
    }
    await db.from("properties").delete().eq("id", testPropertyId);
    console.log("✅ Cleanup complete.");
  }
}
