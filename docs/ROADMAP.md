# Kiraya — Build Roadmap & Status

Legend: ✅ done · 🟡 in progress · ⬜ not started

> **Open mode is on.** Phone OTP is deferred until deployment — a production India rollout needs a
> DLT-registered SMS provider, and waiting on that shouldn't block MVP3–5. With
> `NEXT_PUBLIC_OPEN_MODE=true` the whole app is reachable with no sign-in, acting as seeded dev
> identities you switch from the header. The OTP funnel below is built and intact; it's routed
> around, not removed. Turning it back on is one env var. See the README.

## MVP1 — Identity & Intent
- ✅ Schema: `profiles`, `localities`, `tenant_intents` + enums + RLS (`0001`)
- ✅ Supabase clients (browser / server / middleware) with `@supabase/ssr`
- ✅ Phone OTP: `/login` → `/verify` (send + verify server actions)
- ✅ Role selection `/onboarding/role`
- ✅ Tenant intent form `/onboarding/intent`
- ✅ Onboarding state machine in `middleware.ts`
- ✅ `/dashboard` post-onboarding home
- 🟡 **Deferred until deploy:** OTP gate bypassed by open mode (`src/lib/open-mode.ts`)
- ✅ **Security model verified against real sessions** — `npm run verify:rls` signs in as each
  seeded identity with a real JWT and asserts 24 behaviours across RLS, the `properties_guard`
  trigger and the `0005` admin RPCs. All pass. Uses email+password on the dev users purely as a
  test harness; phone OTP remains the production path.
- ⬜ Rate-limiting / resend cooldown polish
- ⬜ E2E test of the full funnel (the OTP screens themselves are still untested)
- ⬜ Re-verify the funnel end-to-end once open mode is switched off

## MVP2 — Verified Listings
- ✅ Schema: `properties` + enums + RLS + `v_listings_public` (`0002`)
- ✅ `/listings` feed (filters: BHK, all-in budget, availability, hide-stale, sort)
- ✅ `/listings/[id]` detail with cost breakdown + posted-by + last-verified
- ✅ `/listings/new` create (owner/broker/admin) → `pending_review`
- ✅ Stale badge from `is_stale`; freshness sort puts never-verified last
- ✅ Poster sees own listings + status on `/dashboard`
- ✅ Listing photos (`0006`) — own `captured_at` per photo, cover shot on the card,
  gallery on detail, and an age warning when a photo predates the verification
- ⬜ Edit an existing listing
- ⬜ Pagination beyond the first 60 results
- ⬜ Image resizing / thumbnails (full-size objects are served as-is today)

## MVP3 — History & Mismatch
- ✅ Schema: `property_updates` (+ trigger), `mismatch_reports` + RLS (`0003`)
- ✅ Warning badge renders on card + detail from `has_warning`
- ✅ Update timeline UI on listing detail (`components/listings/update-timeline.tsx`)
- ✅ "Report mismatch" action (tenant-facing, one open report per person)
- ⬜ Staleness demotion job/view surfacing
- ⬜ Admin-facing mismatch queue → arrives with MVP5

## MVP4 — Broker Suggestions
- ✅ Schema: `broker_suggestions` + RLS (`0004`)
- ✅ Broker view of verified intents, no PII (`/broker/intents`)
- ✅ Suggestion compose — dropdown limited to the broker's own live listings
- ✅ Tenant suggestions inbox: accept / decline / not-relevant (`/suggestions`)
- ⬜ Notify the broker on response (needs a notification channel)
- ⬜ Contact exchange on accept (currently just states that it's unlocked)

## MVP5 — Admin Panel
- ✅ Schema: `moderation_actions`, `is_admin()`, `v_locality_health` (`0005`)
- ✅ Listing review queue: approve+verify / reject (`/admin/listings`)
- ✅ Re-verify and take down live listings, oldest verification first
- ✅ Mismatch triage: resolve / dismiss, grouped by listing (`/admin/reports`)
- ✅ Broker management: suspend / reinstate (`/admin/people`)
- ✅ Locality health dashboard with a freshness headline (`/admin`)
- ⬜ Broker trust score (deferred — needs a definition before a UI)
- ⬜ Moderation-action history view (rows are written, nothing reads them yet)

## Cross-cutting backlog
- 🟡 **Sub-locality / area dimension.** The launch market is Pune, and the whole city is modelled
  as one `locality` row (`0007`). The feed therefore has no geography filter: a tenant in Kothrud
  sees Kharadi listings with no way to narrow down, and one `verify_stale_days` covers ~500 km².
  Needs an `area` on `properties` + `tenant_intents` and a filter on the feed, or a split into
  real per-neighbourhood localities. This is the largest known deviation from `docs/PRD.md` §4.6.
- ⬜ DLT-registered SMS provider wired for production OTP (India/TRAI) — **the blocker open mode
  is working around; needed before the auth gate can go back on in production**
- ✅ Seed script for dev identities + sample listings (`npm run db:seed`)
- ⬜ Real cold-start supply for the launch locality (the seed is demo data, not real inventory)
- 🟡 **Page latency.** Listing detail is ~2s in production, ~3s in dev. A single Supabase round
  trip from this machine measures ~180 ms, so the page is latency-bound on a short query
  waterfall, not on Postgres. Already done: `cache()` on `getDataClient`/`getSessionUser`/
  `getActiveLocality` (the session was being fetched twice per request), `getMyOpenReport` folded
  into the parallel batch, and a static `loading.tsx` so a click paints instantly.
  Still open: check the project's region (ap-south-1 for an India product), and consider a single
  RPC returning listing + updates + photos in one hop.
- ⬜ Orphaned Storage objects: deleting a property cascades `property_photos` but leaves the files
  in the bucket. Needs a GC script or a delete flow that clears objects first.
- ⬜ Observability: freshness %, mismatch rate dashboards
- ⬜ CI: typecheck + lint + `supabase db lint`
