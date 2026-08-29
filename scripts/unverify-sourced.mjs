#!/usr/bin/env node
/**
 * unverify-sourced.mjs — strip the verification stamp from seeded listings.
 *
 * Admin approval welds "live" and "verified" together (see src/lib/admin.ts),
 * so a listing imported from an outside post (a Facebook ad) shows "Verified by
 * Kiraya" the moment it's approved — which is false: Kiraya never confirmed it.
 * A listing is "seeded" iff it has a listing_sources row (0034), so this clears
 * last_verified_at / last_verified_by for exactly those, leaving them honestly
 * "never verified" until someone actually confirms them.
 *
 * Idempotent. Run it after approving a batch of imported listings:
 *   npm run db:unverify-sourced
 *
 * Uses the service-role key, which bypasses the properties guard (auth.uid() is
 * null) — the same path npm run db:seed uses.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(file) {
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
      if (!m) continue;
      const value = m[2].trim().replace(/^["']|["']$/g, "");
      if (!(m[1] in process.env)) process.env[m[1]] = value;
    }
  } catch {}
}
loadEnv(".env.local");

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SERVICE_KEY) {
  console.error("✗ NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
  process.exit(1);
}

const db = createClient(URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: sources, error: srcErr } = await db.from("listing_sources").select("property_id");
if (srcErr) {
  console.error("✗ Could not read listing_sources:", srcErr.message);
  process.exit(1);
}

const ids = [...new Set((sources ?? []).map((s) => s.property_id))];
if (ids.length === 0) {
  console.log("  No seeded (sourced) listings — nothing to clear.");
  process.exit(0);
}

// Only touch the ones that actually carry a stamp, so the report is truthful.
const { data: stamped } = await db
  .from("properties")
  .select("id, title")
  .in("id", ids)
  .not("last_verified_at", "is", null);

if (!stamped || stamped.length === 0) {
  console.log(`  ${ids.length} sourced listing(s), none currently stamped — nothing to clear.`);
  process.exit(0);
}

const { error } = await db
  .from("properties")
  .update({ last_verified_at: null, last_verified_by: null })
  .in(
    "id",
    stamped.map((p) => p.id),
  );
if (error) {
  console.error("✗ Update failed:", error.message);
  process.exit(1);
}

console.log(`\n✓ Cleared the verification stamp from ${stamped.length} sourced listing(s):`);
for (const p of stamped) console.log(`  - ${p.title}`);
console.log();
