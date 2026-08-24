#!/usr/bin/env node
/**
 * verify-rls.mjs — exercise the security model with REAL authenticated sessions.
 *
 * Open mode talks to Postgres with the service-role key, so `auth.uid()` is
 * always null and RLS, the `properties_guard` trigger and the `0005` admin RPCs
 * never actually run. This signs in as each seeded dev identity with a real JWT
 * and asserts what each role can and cannot do.
 *
 *   npm run db:seed && npm run verify:rls
 *
 * Read-blocks show up as zero rows (RLS filters silently); write-blocks show up
 * as errors. The assertions below distinguish the two deliberately.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { DEV_PASSWORD, devEmail } from "./seed-dev.mjs";

function loadEnv(file) {
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
      if (!m) continue;
      if (!(m[1] in process.env)) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {}
}
loadEnv(".env.local");

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !ANON || !SERVICE) {
  console.error("✗ NEXT_PUBLIC_SUPABASE_URL, ANON_KEY and SERVICE_ROLE_KEY must all be set.");
  process.exit(1);
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

// --- assertions -------------------------------------------------------------
const results = [];
const record = (ok, label, detail) => {
  results.push({ ok, label, detail });
  console.log(`  ${ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${label}${detail ? `\n      ${detail}` : ""}`);
};

/** A write that must be rejected by RLS or a trigger. */
async function mustFail(label, promise) {
  const { error } = await promise;
  record(Boolean(error), label, error ? `blocked: ${error.message}` : "NOT BLOCKED — write succeeded");
}

/** A write that must be allowed. */
async function mustSucceed(label, promise) {
  const { error } = await promise;
  record(!error, label, error ? `unexpectedly blocked: ${error.message}` : null);
}

/** A read whose visible row count must match. */
async function mustSee(label, promise, expected) {
  const { data, error } = await promise;
  if (error) return record(false, label, `errored: ${error.message}`);
  const n = (data ?? []).length;
  record(n === expected, label, n === expected ? null : `saw ${n} rows, expected ${expected}`);
}

async function signIn(key) {
  const client = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: devEmail(key),
    password: DEV_PASSWORD,
  });
  if (error) {
    console.error(`✗ could not sign in as ${key}: ${error.message}`);
    console.error("  Run `npm run db:seed` first — it sets the dev credentials.");
    process.exit(1);
  }
  return { client, userId: data.user.id };
}

async function main() {
  console.log("\nVerifying the security model with real sessions\n");

  // Fixtures we assert against, read with service-role so setup never lies.
  const { data: props } = await admin.from("properties").select("*").order("title");
  const live = props.find((p) => p.status === "live");
  const pending = props.find((p) => p.status === "pending_review");
  const { data: localities } = await admin.from("localities").select("*").eq("slug", process.env.NEXT_PUBLIC_ACTIVE_LOCALITY_SLUG ?? "pune");
  const locality = localities[0];
  const { data: intents } = await admin.from("tenant_intents").select("*").eq("status", "active");
  const intent = intents[0];

  if (!live || !pending || !locality || !intent) {
    console.error("✗ expected seed data is missing — run `npm run db:seed`.");
    process.exit(1);
  }

  // Snapshot so the harness can undo anything a passing write leaves behind.
  const { data: suggestionsBefore } = await admin.from("broker_suggestions").select("id");
  const preexistingSuggestions = new Set((suggestionsBefore ?? []).map((s) => s.id));

  const sessions = {};
  for (const key of ["tenant", "owner", "broker", "admin"]) sessions[key] = await signIn(key);

  // --- anon -----------------------------------------------------------------
  console.log("\nanon (no session)");
  const anon = createClient(URL, ANON, { auth: { persistSession: false } });
  await mustSee("sees live listings through v_listings_public",
    anon.from("v_listings_public").select("id"), props.filter((p) => p.status === "live").length);
  await mustSee("cannot see the pending listing in `properties`",
    anon.from("properties").select("id").eq("id", pending.id), 0);
  await mustSee("cannot read anyone's profile",
    anon.from("profiles").select("id"), 0);
  await mustFail("cannot insert a property",
    anon.from("properties").insert({ posted_by: sessions.owner.userId, locality_id: locality.id, title: "anon injection attempt", bhk: "2bhk", rent: 1000, available_from: "2026-12-01" }));

  // --- tenant ---------------------------------------------------------------
  console.log("\ntenant");
  const { client: tenant, userId: tenantId } = sessions.tenant;
  await mustSee("reads only their own profile",
    tenant.from("profiles").select("id"), 1);
  await mustFail("cannot post a property (role gate in 0002)",
    tenant.from("properties").insert({ posted_by: tenantId, locality_id: locality.id, title: "tenant should not post this", bhk: "2bhk", rent: 20000, available_from: "2026-12-01" }));
  await mustFail("cannot file a mismatch report as someone else",
    tenant.from("mismatch_reports").insert({ property_id: live.id, reported_by: sessions.owner.userId, type: "other" }));
  await mustFail("cannot self-promote to admin",
    tenant.from("profiles").update({ role: "admin" }).eq("id", tenantId));
  await mustFail("cannot call admin_review_listing",
    tenant.rpc("admin_review_listing", { p_property: pending.id, p_approve: true, p_note: null }));
  await mustFail("cannot suspend anyone",
    tenant.rpc("admin_set_suspended", { p_user: sessions.broker.userId, p_suspended: true, p_note: null }));

  // --- owner ----------------------------------------------------------------
  console.log("\nowner");
  const { client: owner, userId: ownerId } = sessions.owner;
  await mustSucceed("can post a property",
    owner.from("properties").insert({ posted_by: ownerId, locality_id: locality.id, title: "RLS harness — owner draft", bhk: "1bhk", rent: 15000, available_from: "2026-12-01", status: "pending_review" }));
  await mustFail("cannot publish it themselves (properties_guard)",
    owner.from("properties").insert({ posted_by: ownerId, locality_id: locality.id, title: "RLS harness — self published", bhk: "1bhk", rent: 15000, available_from: "2026-12-01", status: "live" }));
  await mustFail("cannot forge a verification stamp (properties_guard)",
    owner.from("properties").insert({ posted_by: ownerId, locality_id: locality.id, title: "RLS harness — self verified", bhk: "1bhk", rent: 15000, available_from: "2026-12-01", last_verified_at: new Date().toISOString() }));
  await mustFail("cannot flip an existing listing to live",
    owner.from("properties").update({ status: "live" }).eq("id", pending.id));
  await mustFail("cannot post on someone else's behalf",
    owner.from("properties").insert({ posted_by: sessions.broker.userId, locality_id: locality.id, title: "RLS harness — impersonation", bhk: "1bhk", rent: 15000, available_from: "2026-12-01" }));

  // --- owner self-confirmation (0009) ---------------------------------------
  // 0009 opened exactly one hole in properties_guard: a poster may restamp
  // verification on their OWN listing, in their OWN name, dated now. Everything
  // adjacent to that must still be refused, so assert the edges — not just the
  // happy path, which is the easy half.
  const ownerLive = props.find((p) => p.posted_by === ownerId && p.status === "live");
  if (!ownerLive) {
    record(false, "0009: owner has a live listing to confirm", "no live owner listing in seed");
  } else {
    const stampBefore = ownerLive.last_verified_at;

    await mustSucceed("can confirm their own live listing (0009)",
      owner.from("properties").update({ last_verified_at: new Date().toISOString(), last_verified_by: ownerId }).eq("id", ownerLive.id));

    await mustFail("cannot backdate the confirmation",
      owner.from("properties").update({ last_verified_at: new Date(Date.now() - 30 * 86_400_000).toISOString(), last_verified_by: ownerId }).eq("id", ownerLive.id));

    await mustFail("cannot post-date the confirmation",
      owner.from("properties").update({ last_verified_at: new Date(Date.now() + 30 * 86_400_000).toISOString(), last_verified_by: ownerId }).eq("id", ownerLive.id));

    await mustFail("cannot stamp it in an admin's name",
      owner.from("properties").update({ last_verified_at: new Date().toISOString(), last_verified_by: sessions.admin.userId }).eq("id", ownerLive.id));

    await mustFail("cannot clear an existing verification",
      owner.from("properties").update({ last_verified_at: null, last_verified_by: null }).eq("id", ownerLive.id));

    // Someone else's listing stays untouchable — RLS refuses before the guard
    // even runs, so this asserts the outer boundary rather than the trigger.
    const notOwners = props.find((p) => p.posted_by !== ownerId && p.status === "live");
    if (notOwners) {
      await mustSee("confirming someone else's listing changes nothing",
        owner.from("properties").update({ last_verified_at: new Date().toISOString(), last_verified_by: ownerId }).eq("id", notOwners.id).select("id"), 0);
    }

    // Put the seed stamp back so re-running the harness is idempotent.
    await admin.from("properties").update({ last_verified_at: stampBefore, last_verified_by: ownerLive.last_verified_by }).eq("id", ownerLive.id);
  }

  // --- contact exchange (0010) ----------------------------------------------
  // The one policy in the schema that WIDENS access: an exchange lets two
  // people read each other's profile. Worth proving in both directions — that
  // it opens for the pair, and stays shut for everyone and everything else.
  console.log("\ncontact exchange (0010)");
  const ownerListing = props.find((p) => p.posted_by === ownerId && p.status === "live");
  if (!ownerListing) {
    record(false, "0010: an owner listing exists to enquire on", "no live owner listing in seed");
  } else {
    await admin.from("contact_exchanges").delete().eq("tenant_id", tenantId).eq("property_id", ownerListing.id);

    await mustSee("tenant cannot read the owner's profile before enquiring",
      tenant.from("profiles").select("id").eq("id", ownerId), 0);

    await mustFail("cannot enquire naming an unrelated counterparty",
      tenant.from("contact_exchanges").insert({ property_id: ownerListing.id, tenant_id: tenantId, counterparty_id: sessions.broker.userId, source: "listing" }));

    await mustFail("cannot enquire on someone else's behalf",
      tenant.from("contact_exchanges").insert({ property_id: ownerListing.id, tenant_id: sessions.broker.userId, counterparty_id: ownerId, source: "listing" }));

    await mustFail("cannot enquire on a listing that isn't live",
      tenant.from("contact_exchanges").insert({ property_id: pending.id, tenant_id: tenantId, counterparty_id: pending.posted_by, source: "listing" }));

    await mustFail("cannot claim a broker suggestion that was never accepted",
      tenant.from("contact_exchanges").insert({ property_id: ownerListing.id, tenant_id: tenantId, counterparty_id: ownerId, source: "suggestion" }));

    await mustSucceed("tenant can enquire on a live listing",
      tenant.from("contact_exchanges").insert({ property_id: ownerListing.id, tenant_id: tenantId, counterparty_id: ownerId, source: "listing", message: "RLS harness enquiry" }));

    await mustFail("cannot enquire twice on the same listing",
      tenant.from("contact_exchanges").insert({ property_id: ownerListing.id, tenant_id: tenantId, counterparty_id: ownerId, source: "listing" }));

    // The payoff: the exchange is what makes the number readable, both ways.
    await mustSee("tenant can now read the owner's profile",
      tenant.from("profiles").select("id, phone").eq("id", ownerId), 1);
    await mustSee("owner can now read the tenant's profile",
      owner.from("profiles").select("id, phone").eq("id", tenantId), 1);

    // ...and only that one profile. An exchange is not a general unlock.
    await mustSee("owner still cannot read an unrelated tenant",
      owner.from("profiles").select("id").eq("id", sessions.broker.userId), 0);
    await mustSee("an unrelated broker cannot see the exchange",
      sessions.broker.client.from("contact_exchanges").select("id").eq("property_id", ownerListing.id), 0);

    // An exchange is a fact that happened — neither side gets to rewrite it.
    await mustSee("tenant cannot edit the exchange afterwards",
      tenant.from("contact_exchanges").update({ message: "rewritten" }).eq("property_id", ownerListing.id).select("id"), 0);

    await admin.from("contact_exchanges").delete().eq("tenant_id", tenantId).eq("property_id", ownerListing.id);
  }

  // --- broker ---------------------------------------------------------------
  console.log("\nbroker");
  const { client: broker, userId: brokerId } = sessions.broker;
  const brokerLive = props.find((p) => p.posted_by === brokerId && p.status === "live");
  await mustSee("can read active tenant intents (0004)",
    broker.from("tenant_intents").select("id").eq("status", "active"), intents.length);
  await mustSee("still cannot read tenant profiles / PII",
    broker.from("profiles").select("id").eq("id", tenantId), 0);

  // Re-send an (intent, property) pair that already exists — anything else is
  // a legitimately new suggestion and proves nothing about the unique index.
  const { data: sent } = await admin
    .from("broker_suggestions")
    .select("*")
    .eq("broker_id", brokerId)
    .limit(1);
  if (sent?.length) {
    await mustFail("cannot suggest the same listing to the same tenant twice",
      broker.from("broker_suggestions").insert({ broker_id: brokerId, tenant_intent_id: sent[0].tenant_intent_id, property_id: sent[0].property_id }));
  } else {
    record(false, "cannot suggest the same listing twice", "no seeded suggestion to duplicate");
  }
  await mustFail("cannot suggest a listing that isn't live",
    broker.from("broker_suggestions").insert({ broker_id: brokerId, tenant_intent_id: intent.id, property_id: pending.id }));
  await mustFail("cannot send a suggestion as another broker",
    broker.from("broker_suggestions").insert({ broker_id: ownerId, tenant_intent_id: intent.id, property_id: brokerLive?.id ?? live.id }));

  // --- tenant reading someone else's intent ---------------------------------
  console.log("\ntenant vs tenant");
  const { data: otherIntents } = await admin.from("tenant_intents").select("*").neq("tenant_id", tenantId);
  if (otherIntents?.length) {
    await mustSee("cannot read another tenant's intent",
      tenant.from("tenant_intents").select("id").eq("id", otherIntents[0].id), 0);
  } else {
    record(true, "cannot read another tenant's intent", "skipped — only one tenant has an intent");
  }

  // --- admin ----------------------------------------------------------------
  console.log("\nadmin");
  const { client: adminUser } = sessions.admin;
  await mustSucceed("admin_verify_listing runs",
    adminUser.rpc("admin_verify_listing", { p_property: live.id, p_note: "rls harness" }));
  await mustSee("sees pending listings",
    adminUser.from("properties").select("id").eq("status", "pending_review"),
    (await admin.from("properties").select("id").eq("status", "pending_review")).data.length);
  await mustSucceed("can read every profile",
    adminUser.from("profiles").select("id"));

  // --- cleanup --------------------------------------------------------------
  // The harness must leave the database exactly as it found it.
  await admin.from("properties").delete().like("title", "RLS harness —%");

  const { data: suggestionsAfter } = await admin.from("broker_suggestions").select("id");
  const strays = (suggestionsAfter ?? [])
    .map((s) => s.id)
    .filter((id) => !preexistingSuggestions.has(id));
  for (const id of strays) await admin.from("broker_suggestions").delete().eq("id", id);
  if (strays.length) console.log(`\n  (cleaned up ${strays.length} suggestion(s) left by the run)`);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} assertions passed`);
  if (failed.length) {
    console.log("\n\x1b[31mFAILED:\x1b[0m");
    for (const f of failed) console.log(`  • ${f.label} — ${f.detail}`);
    process.exit(1);
  }
  console.log("\n✓ Security model behaves as designed.\n");
}

main().catch((e) => {
  console.error("✗ harness crashed:", e);
  process.exit(1);
});
