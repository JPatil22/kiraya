#!/usr/bin/env node
/**
 * import-listing.mjs — insert listings sourced from an outside post (Facebook)
 * straight into the database: live, honestly unverified, with their private
 * source note. Skips the form + admin-approval round-trip.
 *
 * Edit the LISTINGS array below and run:  node scripts/import-listing.mjs
 *
 * Service-role, so the properties guard passes through (auth.uid() is null); the
 * brokerage guard still runs, so a broker listing states a fee and an owner
 * listing carries none. last_verified_at is left null on purpose — a scraped
 * listing is not one Kiraya verified.
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

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const LOCALITY_SLUG = process.env.NEXT_PUBLIC_ACTIVE_LOCALITY_SLUG ?? "pune";

// --- listings to import ------------------------------------------------------
// Fill one entry per listing, then run. role: "broker" states a brokerage;
// "owner" carries none (brokerage forced to 0). areaId is an `areas` row UUID.
// Example:
//   {
//     role: "broker",
//     title: "2BHK semi-furnished in Wakad — Some Society",
//     areaId: "4386e1fe-0b9f-46f8-9c79-b81a89214b56", // Wakad
//     addressLine: "Some Society, Wakad",
//     bhk: "2bhk",          // 1rk | 1bhk | 2bhk | 3bhk | 4plus
//     furnishing: "semi",   // unfurnished | semi | full
//     occupancy: "family",  // family | bachelors_male | bachelors_female | any
//     rent: 30000, maintenance: 0, deposit: 60000, brokerage: 30000, oneTime: 1000,
//     availableFrom: "2026-09-01", availability: "available",
//     description: "…",
//     sourceName: "Broker", // real broker name, or "Broker" when the post gives none
//     sourcePhone: "9XXXXXXXXX",
//     sourceNote: "where it came from, caveats — private, admin/poster only",
//   },
const LISTINGS = [];

// --- resolve the shared bits -------------------------------------------------
const { data: locality } = await db
  .from("localities")
  .select("id")
  .eq("slug", LOCALITY_SLUG)
  .maybeSingle();
if (!locality) {
  console.error(`✗ No locality with slug '${LOCALITY_SLUG}'.`);
  process.exit(1);
}

// Seeded open-mode posters (see scripts/seed-dev.mjs).
const POSTER_PHONE = { broker: "+919000000003", owner: "+919000000002" };
const posterId = {};
for (const role of ["broker", "owner"]) {
  const { data } = await db
    .from("profiles")
    .select("id")
    .eq("phone", POSTER_PHONE[role])
    .maybeSingle();
  if (data) posterId[role] = data.id;
}

// --- insert ------------------------------------------------------------------
for (const l of LISTINGS) {
  const { data: existing } = await db
    .from("properties")
    .select("id")
    .eq("title", l.title)
    .maybeSingle();
  if (existing) {
    console.log(`  = skip (already exists): ${l.title}`);
    continue;
  }

  const postedBy = posterId[l.role];
  if (!postedBy) {
    console.error(`✗ No seeded ${l.role} identity — run npm run db:seed.`);
    process.exit(1);
  }
  const isBroker = l.role === "broker";

  const { data: created, error } = await db
    .from("properties")
    .insert({
      posted_by: postedBy,
      locality_id: locality.id,
      area_id: l.areaId ?? null,
      latitude: null,
      longitude: null,
      title: l.title,
      description: l.description ?? null,
      address_line: l.addressLine ?? null,
      bhk: l.bhk,
      furnishing: l.furnishing,
      occupancy_pref: l.occupancy,
      rent: l.rent,
      deposit: l.deposit,
      maintenance_monthly: l.maintenance ?? 0,
      brokerage: isBroker ? l.brokerage ?? 0 : 0,
      brokerage_disclosed: isBroker,
      one_time_charges: l.oneTime ?? 0,
      available_from: l.availableFrom,
      availability: l.availability ?? "available",
      status: "live", // straight to the feed; last_verified_at stays null (unverified)
    })
    .select("id")
    .single();
  if (error) {
    console.error(`✗ Insert failed for "${l.title}":`, error.message);
    process.exit(1);
  }

  if (l.sourceName || l.sourcePhone || l.sourceNote) {
    const { error: srcErr } = await db.from("listing_sources").insert({
      property_id: created.id,
      source_name: l.sourceName ?? null,
      source_phone: l.sourcePhone ?? null,
      note: l.sourceNote ?? null,
      created_by: postedBy,
    });
    if (srcErr) console.error(`  ! source note failed: ${srcErr.message}`);
  }

  console.log(`  + ${l.title}  (${created.id})`);
}
console.log("\n✓ Done.\n");
