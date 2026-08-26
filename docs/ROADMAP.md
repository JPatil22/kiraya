# Kiraya — Build Roadmap & Status

Legend: ✅ done · 🟡 in progress · ⬜ not started

> **Open mode is on.** Phone OTP is deferred until deployment — a production India rollout needs a
> DLT-registered SMS provider, and waiting on that shouldn't block product work. With
> `NEXT_PUBLIC_OPEN_MODE=true` the whole app is reachable with no sign-in, acting as seeded dev
> identities you switch from the header. The OTP funnel is built and intact; it's routed around,
> not removed. Turning it back on is one env var — and it has **never been done**, which is the
> single largest unknown in this list.

## The five MVPs

All built. Schema, UI and the loop that connects them: post → review → live → enquire → visit →
report back → moderate.

- **MVP1 Identity & intent** — `profiles`, `tenant_intents`, phone OTP funnel, onboarding state
  machine in middleware, `/dashboard`.
- **MVP2 Verified listings** — `properties`, `v_listings_public`, feed with filters, detail with
  itemised cost and authorship, create + edit, photos with their own `captured_at`.
- **MVP3 History & mismatch** — `property_updates` written by trigger, public timeline, mismatch
  reports, warning at two open reports.
- **MVP4 Broker suggestions** — `/broker/intents` demand board with no PII, suggestion compose
  limited to the broker's own live listings, tenant inbox with accept/decline.
- **MVP5 Admin panel** — review queue, re-verify, takedown, mismatch triage, broker suspension,
  locality health, moderation log, duplicates queue.

## Shipped since (0009–0029)

- ✅ **Owner self-verification** (`0009`) — confirming availability restamps freshness in your own
  name; `verified_by_poster` tells the UI who said it.
- ✅ **Contact exchange** (`0010`) — both numbers revealed at once, daily limit, recorded on both
  sides.
- ✅ **Shortlists** (`0011`) — private, with "what changed since you saved".
- ✅ **Notifications** (`0012`–`0014`, `0022`) — eight kinds, all written by database triggers.
- ✅ **Intent matching** (`0014`) — a new live listing notifies standing intents it fits; never
  your own listing.
- ✅ **Post-visit feedback** (`0015`) — four buttons, no typing; "didn't go" is a first-class
  answer and excluded from the accuracy denominator.
- ✅ **Price context** (`0016`) — median, not mean; the listing excluded from its own comparison;
  silent below three comparables.
- ✅ **Owner replies + engagement counts** (`0017`, `0018`) — right of reply on a mismatch, and
  counts-only stats for posters (never who).
- ✅ **Areas** (`0019`, `0028`, `0029`) — ~59 Pune areas with centres and display zones; drives the
  feed filter, both forms, price comparison and matching.
- ✅ **Visit scheduling** (`0020`, `0022`) — propose/confirm/decline against a contact exchange.
- ✅ **Duplicate detection** (`0021`) — trigram address match plus configuration, area and 5% cost;
  flagged for admins, never merged.
- ✅ **Brokerage disclosure** (`0023`) — a fee is a stated claim; owners cannot charge one.
- ✅ **Intents for any role** (`0024`) — an owner between places is still somebody looking to rent.
- ✅ **The clock** (`0025`) — `pg_cron` jobs nudge listings before they go stale and remind both
  sides of tomorrow's viewing.
- ✅ **Email delivery** (`0026`) — optional address on `profiles`, `emailed_at` queue, digest
  through `/api/notifications/deliver`.
- ✅ **Map pins** (`0027`) — exact `latitude`/`longitude`, Google Maps + Places with an
  OpenStreetMap fallback behind one env var.
- ✅ **UI refresh** — every native `<select>` replaced, indigo accent, 40px controls, sandbox
  switcher demoted out of the product nav.
- ✅ **CI** — typecheck, lint, build and migration-numbering on every push.
- ✅ **Fixtures mode restored** — the four views that had only ever existed as SQL.

## Open

### Blocks launch
- ⬜ **DLT-registered SMS provider** (India/TRAI). The one true blocker: phone OTP is the identity
  bar, and no code can go out without it.
- ⬜ **Switch the auth gate back on.** `NEXT_PUBLIC_OPEN_MODE=false` has never run. RLS, the
  `properties_guard` trigger and the five `0005` admin RPCs are exercised only by `verify:rls`;
  the app itself takes the service-role path every time.
- ⬜ **Walk the OTP funnel.** `/login` → `/verify` → onboarding is intact and untested since
  2026-08-16. No resend cooldown or rate limit — every send costs money, so this is an abuse
  vector as well as a bill.
- ⬜ **Real supply in Pune.** Six seeded demo listings are not a market, and the product's central
  bet cannot be tested or lost until real inventory exists.

### Needed before real traffic
- ⬜ **Deploy.** Nothing is hosted. Automated email delivery needs a public URL (`pg_net` cannot
  reach `localhost`), a verified sender domain needs a real host, and the auth gate can only be
  honestly tested on a deployed instance.
- ⬜ **Verified email sender.** `onboarding@resend.dev` only delivers to the account owner.
- ⬜ **Image resizing / thumbnails.** Full-size uploads are served as-is to phones on mobile data.
- ⬜ **Photo permissions are unproven.** `verify:rls` doesn't touch `property_photos` or Storage.

### Product backlog
- ⬜ **Surface the accuracy data.** `v_listing_accuracy` has tallied real post-visit outcomes since
  `0015` and is rendered nowhere. The most honest trust signal in the system, unused.
- ⬜ **Broker trust score.** PRD open question #1, and the thing that would let verification scale
  past one admin pressing a button per listing.
- ⬜ **Duplicate resolution tooling.** Pairs are flagged; an admin has no merge, no dismiss, and
  tenants are told nothing.
- ⬜ **Multi-area intents.** "Baner or Balewadi" is the normal search; one area per intent was a
  deliberate simplification.
- ⬜ **Observability.** Freshness % and mismatch rate are computable today and tracked over time
  nowhere.
- ⬜ **i18n.** English only, for a mass-market rental product in Pune.
- ⬜ **Relist flow** for an owner whose tenant moved out; shortlist notes and comparison for a
  tenant weighing three flats; a way to report a broker rather than a listing.

### Engineering
- ⬜ **No test tooling.** No Playwright, Vitest or Jest. `verify:rls` is the whole suite and only
  covers the database boundary — not one server action, validator or UI path is tested.
- ⬜ **Orphaned Storage objects.** Deleting a property cascades `property_photos` and leaves the
  files. Currently unreachable (nothing deletes a property), so it's a trap for whoever builds
  delete rather than a live leak.
- 🟡 **Page latency.** Listing detail was ~2s. Already done: `cache()` on the session/locality
  lookups, parallel batching, a static `loading.tsx`. Still open: check the project region
  (ap-south-1 for an India product) and consider one RPC returning listing + updates + photos.
