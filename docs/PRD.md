# Kiraya — Product Requirements Document

> **Kiraya** (किराया — "rent") is a **tenant-first rental platform for a single Indian locality.**
> We win one neighbourhood completely before we touch a second.

---

## 1. Problem

Rental discovery in Indian localities is broken in three specific ways:

| Problem | What the tenant experiences | Root cause |
|---|---|---|
| **Stale listings** | Calls a listing, "already rented 3 weeks ago" | Nobody is incentivised to mark a unit gone |
| **Price mismatches** | Listing says ₹18k, on-site it's ₹22k + "brokerage negotiable" | Rent, deposit, maintenance and brokerage are never shown together |
| **Broker opacity** | Doesn't know who posted, when it was last checked, or if it's real | No verification trail, no accountability, everything happens on WhatsApp |

Existing portals optimise for **listing volume** (good for brokers, monetised by sellers). Kiraya optimises for **listing truth** (good for tenants).

## 2. What we are building (the wedge)

A platform where a tenant trusts three things they cannot trust anywhere else:

1. **Verified tenants** — real, phone-verified people, so brokers/owners take the demand seriously.
2. **Fresh availability** — every listing carries a visible *"last verified"* timestamp and goes stale automatically.
3. **Transparent history** — full cost breakdown, who posted it, and an update log showing every price/availability change.

## 3. Target users

- **Tenant (primary)** — actively looking in this one locality. Wants to stop calling dead listings.
- **Owner** — has a unit in the locality, wants qualified, verified tenants without broker markup.
- **Broker** — operates in the locality, wants warm verified demand. Must play by transparency rules to stay on the platform.
- **Admin (internal)** — curates the locality, verifies listings, moderates brokers.

## 4. Product principles

1. **Tenant is the customer.** When broker convenience and tenant trust conflict, tenant wins.
2. **Truth over volume.** A smaller set of verified-fresh listings beats a large stale index.
3. **Everything has a timestamp and an author.** No anonymous, undated data.
4. **In-app, not WhatsApp.** Interactions leave an auditable trail (MVP4 replaces the WhatsApp broker blast).
5. **No Aadhaar, ever (for MVP).** Phone verification is the identity bar. We deliberately avoid collecting government ID — lower friction, lower liability, no KYC honeypot.
6. **Single locality.** Every screen assumes one `active_locality`. Geography is a later problem.

## 5. Explicit non-goals (for now)

- ❌ Aadhaar / government KYC / document upload
- ❌ Payments, rent collection, escrow, or deposits handled in-app
- ❌ Multi-city / multi-locality switching
- ❌ In-app chat/DMs (MVP4 is structured *suggestions*, not free chat)
- ❌ Native mobile app (responsive web first)
- ❌ Recommendation ML / ranking algorithms

## 6. MVP roadmap

Each MVP is independently shippable and demoable. Ship, learn, then proceed.

### MVP1 — Identity & Intent (the front door)
**Goal:** A real person can enter, prove they're real, pick a role, and (as a tenant) tell us exactly what they want.
- Phone **OTP** login (no passwords, **no Aadhaar**).
- **Role selection**: tenant / owner / broker.
- **Tenant intent form**: budget range, BHK, move-in date, furnishing, occupancy type, notes.
- Onboarding state machine so a half-onboarded user always resumes where they left off.

**Acceptance:** New number → OTP → verify → role → (tenant) intent form → dashboard. Refresh at any step resumes correctly. Data persists in Supabase with RLS enforced.

### MVP2 — Verified Listings (the truth layer)
**Goal:** Tenants browse listings that are *demonstrably* fresh and *fully* priced.
- Property listing with: **availability status**, **`last_verified` timestamp**, **full cost breakdown** (rent + deposit + maintenance + brokerage + one-time), and **"posted by"** (owner/broker/admin, with role badge).
- Listing detail page + locality feed with filters (BHK, budget, availability).
- Owner/broker can create a listing (goes to admin review before it's public — see MVP5).

**Acceptance:** A listing shows a single all-in monthly + move-in cost, a human-readable "verified 2 days ago", and a clear posted-by badge. Stale listings (> `VERIFY_STALE_DAYS`) are visibly flagged.

### MVP3 — History & Mismatch Warnings (the trust engine)
**Goal:** Make the invisible visible — every change and every reported discrepancy.
- **Update history**: append-only log of every change to price / availability / terms, with who and when.
- **Mismatch warnings**: tenants report "listing didn't match reality" (price higher, already rented, wrong furnishing). Aggregated into a visible warning badge + admin queue.
- Auto-staleness: listings not re-verified within the window are demoted and badged.

**Acceptance:** Opening a listing shows "Rent changed ₹18k → ₹20k on 12 Jul". A listing with 2+ open mismatch reports shows a warning to every viewer.

### MVP4 — Broker Suggestions via In-App Cards (killing the WhatsApp blast)
**Goal:** Replace "broker forwards 10 blurry photos on WhatsApp" with a structured, trackable in-app suggestion.
- Broker sees **verified tenant intents** (anonymised contact) and sends a **suggestion card** tied to a real listing.
- Tenant receives suggestions in-app, can **accept / decline / mark not-relevant** — all logged.
- Every suggestion references a real, verified listing (no off-platform "DM me for details").

**Acceptance:** Broker suggests listing X to tenant intent Y → tenant sees a card with the full verified listing → responds → both sides see status. Zero WhatsApp required.

### MVP5 — Admin Panel (the operator's cockpit)
**Goal:** Give the internal operator tools to keep the locality's data true.
- Listing **review/approve/reject** queue; **verify** action that stamps `last_verified_at`.
- **Mismatch report** triage (resolve / dismiss / force re-verify / take down).
- **Broker management**: approve, suspend, view transparency score.
- Locality dashboard: fresh vs. stale counts, open mismatches, active verified tenants.

**Acceptance:** Admin can take a submitted listing live, re-verify it, action a mismatch, and suspend a misbehaving broker — all from one panel, all RLS-guarded to `admin` role.

## 7. Success metrics

- **Freshness:** % of live listings verified within the staleness window (target > 85%).
- **Mismatch rate:** reported mismatches per 100 tenant listing-views (drive down over time).
- **Tenant trust:** % of tenant sessions that reach a listing detail; suggestion accept rate.
- **Supply health:** live-listing count and median `last_verified` age.

## 8. Key risks & mitigations

| Risk | Mitigation |
|---|---|
| **Phone OTP in India needs DLT-registered SMS** (TRAI regulation) | Configure a DLT-registered provider (e.g. via Supabase's provider integration) before launch; in dev, read OTP from local logs. Documented in README. |
| Cold-start supply (no listings) | Admin/owner-seeded listings for the launch locality before tenant marketing. |
| Brokers game "verification" | Verification is an *action with an author* (admin or a trust-scored broker), logged in history; mismatch reports counter-balance. |
| Fake tenant demand | Phone verification + intent form is the bar; suspicious patterns surfaced to admin (MVP5). |

## 9. Open questions (track, don't block)

- Who can *verify* a listing in MVP2 — only admin, or trust-scored brokers too? (Assume **admin-only** until MVP5 introduces broker trust scores.)
- Do owners get the same suggestion powers as brokers in MVP4? (Assume **broker-only** for suggestions initially.)
- Exact staleness window per locality (default **7 days**, configurable via env).
