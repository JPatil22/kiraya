#!/usr/bin/env node
/**
 * seed-dev.mjs — create the open-mode dev identities and a set of sample
 * listings that exercises every trust state the UI can render.
 *
 * Uses the service-role key, so it works against a local or a linked remote
 * project. Idempotent: re-running tops up whatever is missing.
 *
 *   npm run db:push && npm run db:seed
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

// --- env --------------------------------------------------------------------
// Hand-parsed so this runs on any Node 18+ without --env-file.
function loadEnv(file) {
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
      if (!m) continue;
      const value = m[2].trim().replace(/^["']|["']$/g, "");
      if (!(m[1] in process.env)) process.env[m[1]] = value;
    }
  } catch {
    // No .env.local — fall back to the ambient environment.
  }
}
loadEnv(".env.local");

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LOCALITY_SLUG = process.env.NEXT_PUBLIC_ACTIVE_LOCALITY_SLUG ?? "pune";

if (!URL || !SERVICE_KEY) {
  console.error(
    "✗ NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local",
  );
  process.exit(1);
}

const db = createClient(URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const log = (...a) => console.log(" ", ...a);
const die = (msg, error) => {
  console.error(`✗ ${msg}:`, error?.message ?? error);
  process.exit(1);
};

/** Days ago as an ISO timestamp. */
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString();
/** Days from now as a plain date (YYYY-MM-DD). */
const dateIn = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

// --- dev identities ---------------------------------------------------------
// Phones must match DEV_PHONES in src/lib/open-mode.ts — that's how the app
// resolves which profile the sandbox is acting as.
const PEOPLE = [
  { key: "tenant", phone: "+919000000001", role: "tenant", name: "Ananya Rao" },
  { key: "owner", phone: "+919000000002", role: "owner", name: "Suresh Kamath" },
  { key: "broker", phone: "+919000000003", role: "broker", name: "Imran Sheikh" },
  { key: "admin", phone: "+919000000004", role: "admin", name: "Kiraya Ops" },
  // Extra reporter — two open mismatch reports are what trip the warning badge.
  { key: "tenant2", phone: "+919000000005", role: "tenant", name: "Priya Nair" },
];

/**
 * Each dev identity also gets an email + password.
 *
 * Phone OTP stays the production path — this exists purely so a test harness
 * can mint a REAL authenticated session (`npm run verify:rls`) without a DLT
 * SMS provider. Without it, `auth.uid()` is null everywhere and RLS, the
 * properties_guard trigger and the admin RPCs are never exercised at all.
 *
 * Dev project only. These accounts are synthetic and the password is public.
 */
export const devEmail = (key) => `${key}@kiraya.dev`;
export const DEV_PASSWORD = process.env.KIRAYA_DEV_PASSWORD ?? "kiraya-dev-only-pw";

const digits = (p) => p.replace(/\D/g, "");

async function findAuthUserByPhone(phone) {
  const want = digits(phone);
  // Small fixed set of seed users; one page is plenty.
  const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) die("could not list auth users", error);
  return data.users.find((u) => u.phone && digits(u.phone) === want) ?? null;
}

async function ensurePerson(person, localityId) {
  let user = await findAuthUserByPhone(person.phone);

  if (!user) {
    const { data, error } = await db.auth.admin.createUser({
      phone: person.phone,
      phone_confirm: true,
      user_metadata: { full_name: person.name, seeded: true },
    });
    if (error) die(`could not create auth user ${person.phone}`, error);
    user = data.user;
    log(`+ auth user ${person.phone} (${person.role})`);
  }

  // Password credentials for the RLS harness (see DEV_PASSWORD above).
  const { error: credError } = await db.auth.admin.updateUserById(user.id, {
    email: devEmail(person.key),
    email_confirm: true,
    password: DEV_PASSWORD,
  });
  if (credError) die(`could not set dev credentials for ${person.phone}`, credError);

  // The on_auth_user_created trigger already made the profile row; fill in the
  // parts onboarding would normally set. Phone is rewritten in +E.164 form
  // because GoTrue stores it without the leading "+".
  const { error } = await db
    .from("profiles")
    .update({
      phone: person.phone,
      full_name: person.name,
      role: person.role,
      onboarding_step: "done",
      active_locality_id: localityId,
    })
    .eq("id", user.id);
  if (error) die(`could not update profile for ${person.phone}`, error);

  return user.id;
}

// --- sample listings --------------------------------------------------------
// Between them these cover: fresh, stale, never-verified, mismatch-warning and
// in-review — i.e. every badge state on the feed and the detail page.
//
// Spread across Pune on purpose. The locality is the whole city, so the feed has
// no geography filter: this data makes that gap visible rather than hiding it
// behind six listings on the same street.
const LISTINGS = [
  {
    by: "owner",
    title: "Bright 2BHK off Balewadi High Street",
    description:
      "East-facing corner unit on the 4th floor. Covered parking for one car. Walk to Balewadi High Street.",
    address_line: "Balewadi, Baner",
    bhk: "2bhk",
    furnishing: "semi",
    occupancy_pref: "family",
    rent: 28000,
    deposit: 150000,
    maintenance_monthly: 2000,
    brokerage: 0,
    one_time_charges: 5000,
    availability: "available",
    available_from: dateIn(10),
    status: "live",
    last_verified_at: daysAgo(1),
    verified_by: "admin",
  },
  {
    by: "broker",
    title: "Spacious 3BHK in Kharadi, near EON IT Park",
    description: "Two balconies, 24x7 water and backup. Society has a gym, lift and clubhouse.",
    address_line: "Nyati Estate Road, Kharadi",
    bhk: "3bhk",
    furnishing: "full",
    occupancy_pref: "any",
    rent: 45000,
    deposit: 250000,
    maintenance_monthly: 3500,
    brokerage: 45000,
    one_time_charges: 10000,
    availability: "available",
    available_from: dateIn(21),
    status: "live",
    last_verified_at: daysAgo(4),
    verified_by: "admin",
  },
  {
    by: "owner",
    title: "Compact 1BHK on Paud Road, Kothrud",
    description: "Independent floor with a separate entrance. Ideal for a couple or single tenant.",
    address_line: "Paud Road, Kothrud",
    bhk: "1bhk",
    furnishing: "unfurnished",
    occupancy_pref: "any",
    rent: 16000,
    deposit: 80000,
    maintenance_monthly: 1200,
    brokerage: 0,
    one_time_charges: 3000,
    availability: "available",
    available_from: dateIn(5),
    status: "live",
    // Older than the 7-day window → renders as stale.
    last_verified_at: daysAgo(12),
    verified_by: "admin",
  },
  {
    by: "broker",
    title: "Semi-furnished 2BHK in Wakad",
    description: "Wardrobes and modular kitchen included. Two-wheeler parking only.",
    address_line: "Datta Mandir Road, Wakad",
    bhk: "2bhk",
    furnishing: "semi",
    occupancy_pref: "bachelors_male",
    rent: 24000,
    deposit: 120000,
    maintenance_monthly: 1800,
    brokerage: 24000,
    one_time_charges: 4000,
    availability: "available",
    available_from: dateIn(3),
    status: "live",
    // Never verified → sinks to the bottom of the freshness sort.
    last_verified_at: null,
    verified_by: null,
  },
  {
    by: "owner",
    title: "1RK studio near Viman Nagar Phoenix",
    description: "Compact studio with attached bath. Water and maintenance included.",
    address_line: "Nagar Road, Viman Nagar",
    bhk: "1rk",
    furnishing: "semi",
    occupancy_pref: "bachelors_female",
    rent: 12000,
    deposit: 50000,
    maintenance_monthly: 900,
    brokerage: 0,
    one_time_charges: 2000,
    availability: "available",
    available_from: dateIn(1),
    status: "live",
    last_verified_at: daysAgo(2),
    verified_by: "admin",
    // Gets two open mismatch reports below → warning badge.
    mismatches: [
      { by: "tenant", type: "price_higher", description: "Owner quoted ₹14,000 on the call, not ₹12,000." },
      { by: "tenant2", type: "already_rented", description: "Was told it went last week." },
    ],
  },
  {
    by: "owner",
    title: "Premium 3BHK duplex in Koregaon Park",
    description: "Top-floor duplex with a private terrace. Available after the current tenant exits.",
    address_line: "Lane 6, Koregaon Park",
    bhk: "3bhk",
    furnishing: "full",
    occupancy_pref: "family",
    rent: 75000,
    deposit: 400000,
    maintenance_monthly: 5000,
    brokerage: 0,
    one_time_charges: 12000,
    availability: "available",
    available_from: dateIn(30),
    // Not public yet — shows as "In review" on the poster's dashboard.
    status: "pending_review",
    last_verified_at: null,
    verified_by: null,
  },
];

async function main() {
  console.log("\nSeeding Kiraya open-mode sandbox\n");

  const { data: locality, error: localityError } = await db
    .from("localities")
    .select("*")
    .eq("slug", LOCALITY_SLUG)
    .maybeSingle();
  if (localityError) die("could not read localities", localityError);
  if (!locality) {
    die(
      "locality lookup",
      `no locality with slug "${LOCALITY_SLUG}" — run \`npm run db:push\` first (0001 seeds it).`,
    );
  }
  log(`locality: ${locality.name} (stale after ${locality.verify_stale_days} days)`);

  // --- people ---------------------------------------------------------------
  const ids = {};
  for (const person of PEOPLE) {
    ids[person.key] = await ensurePerson(person, locality.id);
  }
  log(`${PEOPLE.length} dev identities ready`);

  // --- tenant intent --------------------------------------------------------
  // Scoped to the locality: an intent left over from a previous launch market
  // must not stop a fresh one being created here.
  const { data: existingIntent } = await db
    .from("tenant_intents")
    .select("id")
    .eq("tenant_id", ids.tenant)
    .eq("locality_id", locality.id)
    .maybeSingle();

  if (!existingIntent) {
    const { error } = await db.from("tenant_intents").insert({
      tenant_id: ids.tenant,
      locality_id: locality.id,
      budget_min: 20000,
      budget_max: 35000,
      bhk: "2bhk",
      move_in_date: dateIn(21),
      furnishing: "semi",
      occupancy: "family",
      notes: "Prefer a ground or first floor, and covered parking for one car.",
    });
    if (error) die("could not insert tenant intent", error);
    log("+ tenant intent for the dev tenant");
  }

  // --- listings -------------------------------------------------------------
  const propertyIds = {};
  for (const spec of LISTINGS) {
    const { data: existing } = await db
      .from("properties")
      .select("id")
      .eq("title", spec.title)
      .maybeSingle();

    if (existing) {
      propertyIds[spec.title] = existing.id;
      continue;
    }

    const { mismatches: _m, by, verified_by, ...row } = spec;
    const { data, error } = await db
      .from("properties")
      .insert({
        ...row,
        posted_by: ids[by],
        locality_id: locality.id,
        // Direct DB access: auth.uid() is null, so properties_guard passes
        // through and we can seed `live` + verification stamps (0002).
        last_verified_by: verified_by ? ids[verified_by] : null,
      })
      .select("id")
      .single();
    if (error) die(`could not insert listing "${spec.title}"`, error);

    propertyIds[spec.title] = data.id;
    log(`+ listing "${spec.title}" (${spec.status})`);
  }

  // --- mismatch reports -----------------------------------------------------
  for (const spec of LISTINGS) {
    if (!spec.mismatches) continue;
    const propertyId = propertyIds[spec.title];

    for (const report of spec.mismatches) {
      const { data: existing } = await db
        .from("mismatch_reports")
        .select("id")
        .eq("property_id", propertyId)
        .eq("reported_by", ids[report.by])
        .maybeSingle();
      if (existing) continue;

      const { error } = await db.from("mismatch_reports").insert({
        property_id: propertyId,
        reported_by: ids[report.by],
        type: report.type,
        description: report.description,
      });
      if (error) die("could not insert mismatch report", error);
      log(`+ mismatch report on "${spec.title}" (${report.type})`);
    }
  }

  // --- broker suggestion (MVP4) ---------------------------------------------
  // Needs the tenant's intent and one of the broker's own LIVE listings — the
  // 0004 insert policy rejects anything else.
  const suggestable = propertyIds["Spacious 3BHK in Kharadi, near EON IT Park"];
  const { data: theIntent } = await db
    .from("tenant_intents")
    .select("id")
    .eq("tenant_id", ids.tenant)
    .eq("locality_id", locality.id)
    .maybeSingle();

  if (suggestable && theIntent) {
    const { data: existing } = await db
      .from("broker_suggestions")
      .select("id")
      .eq("tenant_intent_id", theIntent.id)
      .eq("property_id", suggestable)
      .maybeSingle();

    if (!existing) {
      const { error } = await db.from("broker_suggestions").insert({
        broker_id: ids.broker,
        tenant_intent_id: theIntent.id,
        property_id: suggestable,
        message:
          "Slightly over your ceiling, but it's fully furnished and maintenance is included.",
      });
      if (error) die("could not insert broker suggestion", error);
      log("+ broker suggestion for the dev tenant");
    }
  }

  // --- update history -------------------------------------------------------
  // Real UPDATEs, so the 0003 trigger writes genuine property_updates rows for
  // the MVP3 timeline to read. No-ops on a re-run, so nothing duplicates.
  const priceChange = propertyIds["Bright 2BHK off Balewadi High Street"];
  if (priceChange) {
    const { error } = await db.from("properties").update({ rent: 30000 }).eq("id", priceChange);
    if (error) die("could not apply the seeded price change", error);
  }

  const availabilityChange = propertyIds["Spacious 3BHK in Kharadi, near EON IT Park"];
  if (availabilityChange) {
    const { error } = await db
      .from("properties")
      .update({ availability: "on_hold" })
      .eq("id", availabilityChange);
    if (error) die("could not apply the seeded availability change", error);
  }

  const { count } = await db
    .from("property_updates")
    .select("id", { count: "exact", head: true });
  log(`${count ?? 0} rows in property_updates (logged by the 0003 trigger)`);

  console.log("\n✓ Done. Run `npm run dev` and open http://localhost:3000\n");
}

// Only seed when run directly — verify-rls.mjs imports the dev credentials from
// this module and must not trigger a reseed on import.
const isDirectRun =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectRun) {
  main().catch((error) => die("seed failed", error));
}
