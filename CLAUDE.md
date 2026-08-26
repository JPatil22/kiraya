# CLAUDE.md — Kiraya

Tenant-first rental platform for **one Indian locality**. Optimises for listing **truth**
(freshness, transparent cost, authorship) over listing volume. See `docs/PRD.md`.

**Launch market: Pune** (`NEXT_PUBLIC_ACTIVE_LOCALITY_SLUG=pune`, seeded by `0007`). The city is
one `locality` row; neighbourhoods are `areas` (`0019`, extended to ~59 in `0029`), which drive the
feed filter, intent matching and price comparison.

## Stack
- **Next.js** (App Router, RSC, Server Actions) + TypeScript
- **Supabase** (Postgres, Auth phone-OTP, RLS) via `@supabase/ssr`
- **Tailwind** v3 + **shadcn/ui** (new-york, slate) — indigo accent, see `globals.css`
- **Google Maps** (JS API + Places) with a Leaflet/OpenStreetMap fallback
- **Resend** for email delivery of notifications

## Layout
```
docs/                 PRD, SCHEMA, FLOWS, ROADMAP  ← read these first
supabase/migrations/  0001…0029. Each `NNNN_*.sql` has an `_NNNN_apply.sql` twin
src/app/              routes (App Router) + /api/notifications/deliver
src/lib/supabase/     client.ts (browser) · server.ts (RSC/actions) · middleware.ts (session)
src/lib/validators.ts zod schemas shared by forms + server actions
src/lib/fixtures/     in-memory store + a fake supabase client (see Open mode)
src/components/ui/    shadcn primitives + FieldSelect, the app's one dropdown
src/components/map/   provider switch: google-* / osm-* behind location-picker|map
src/middleware.ts     auth + onboarding-step routing guard
```

**Migrations are applied by pasting `_NNNN_apply.sql` into the Supabase SQL editor.** There is no
CLI link and no DB password in `.env.local`, so that file — idempotent, with a header explaining
what it does — is the only DDL path. Always write both files.

## Conventions
- **Money is integer rupees**, stored as separate cost components — never a single blurred price.
- **A brokerage fee is a claim, not a default** (`0023`). A broker must state it (zero allowed,
  silence not); an owner listing cannot carry one. Enforced by `properties_brokerage_guard`, which
  deliberately has **no `auth.uid()` passthrough** — it is integrity, not privilege.
- **Photos carry their own `captured_at`**, separate from `last_verified_at`. A fresh verification
  next to an old photo is a mismatch the UI must surface, not hide (`src/lib/photos.ts`).
- **Everything has an author + timestamp.** New user-data tables get `created_by`/`created_at`.
- **RLS is the security boundary**, not the app. Every new table ships with policies in its
  migration. Admin checks go through `public.is_admin()` (SECURITY DEFINER).
- **Notifications are written by database triggers**, never by the app (`0012`). The body is frozen
  at insert time: what a notice said must not change because a row later did.
- Onboarding routing is driven by `profiles.onboarding_step` (`role`→`intent`→`done`) in middleware.
- Only `listing_status = 'live'` properties are tenant-visible; read them via `v_listings_public`.
- **No Aadhaar / government KYC.** Phone verification is the identity bar. Do not add document
  upload. Email (`0026`) is a delivery preference only — nothing gates on it.
- Single locality: assume `NEXT_PUBLIC_ACTIVE_LOCALITY_SLUG` everywhere; no city switcher.
- **Never call `supabase.auth.getUser()` in a page or action.** Go through `getSessionUser()` /
  `getDataClient()` in `src/lib/auth.ts` — that's the seam open mode swaps out.
- **Roles gate four things only** (`0024`): saving an intent is open to everyone, posting needs
  `canPost`, sending suggestions is broker-only, `/admin` is admin-only. Everything else is scoped
  by relationship — did you post it, did you enquire on it.

## Open mode (current pre-deploy state)
`NEXT_PUBLIC_OPEN_MODE=true` removes the auth gate: no sign-in, every route reachable, acting role
picked from a cookie via the header switcher, backed by seeded dev profiles (`npm run db:seed`).
See `src/lib/open-mode.ts` and the README.
- OFF unless the value is exactly `"true"` — keep that fail-safe default; don't invert it.
- Phone OTP is **deferred, not deleted.** Leave `(auth)/`, `onboarding/` and the middleware state
  machine intact and working; open mode just routes around them.
- With no session `auth.uid()` is null, so RLS hides everything but `live` listings — open mode
  reads/writes through the service-role client. Keep new features behind `getDataClient()` so they
  work in both modes, and keep writing RLS policies as if auth were on. It's coming back.
- `NEXT_PUBLIC_USE_FIXTURES=true` goes further: in-memory data, no DB at all (`src/lib/fixtures`).
  New queries must use only the builder methods the fixture client implements
  (select/eq/neq/in/is/gte/lte/order/limit/maybeSingle/single/insert/update/delete) or extend it —
  **and a new view needs a case in `client.ts` plus a builder in `data.ts` that follows the SQL.**
  Fixture writes live on a `globalThis` store on purpose — Next instantiates modules separately in
  the RSC and Server Action layers, so plain module state silently loses writes.

## Commands
- `npm run dev` — dev server
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — eslint
- `npm run db:seed` — dev identities + sample listings for open mode (idempotent, service-role)
- `npm run verify:rls` — sign in as each dev identity with a **real JWT** and assert what RLS, the
  triggers and the admin RPCs actually allow. Open mode uses service-role, so this is the only
  thing that exercises the security boundary. **118 assertions. Run it after touching any policy.**
- `node scripts/compare-geocoders.mjs` — measure OSM vs Google on real Pune society names
- `npm run db:types` — regenerate `src/types/database.ts` from the local DB

CI (`.github/workflows/ci.yml`) runs typecheck, lint, build and a migration-numbering check on every
push. `verify:rls` is deliberately excluded — it needs a service-role key and writes real rows.

## Gotchas
- `@supabase/ssr` and `@supabase/supabase-js` must be a compatible pair (currently `^0.12` + `^2.112`).
- Row types in `src/types/database.ts` must be **`type` aliases, not `interface`s** — supabase-js
  needs `Row extends Record<string, unknown>`, and interfaces lack an implicit index signature,
  which silently collapses every query result to `never`.
- The `properties_guard` trigger deliberately passes through when `auth.uid()` is null (direct DB /
  service_role); RLS already blocks anon writes, so it only constrains authenticated non-admins.
- Postgres `numeric` arrives through PostgREST as a **string**. Coordinates go through
  `toCoords()` in `src/lib/geo.ts` for that reason.
- **Google Maps `loading=async`**: the script's `load` event does NOT mean `google.maps.Map`
  exists — it installs `importLibrary` and nothing else. Await `importLibrary("maps"|"places")`,
  never shortcut on `if (window.google)`, and don't wait on the `load` event at all: Fast Refresh
  re-evaluates the module and a listener attached after the event hangs forever. `src/lib/maps.ts`
  polls instead. Build maps in a second effect keyed on a `ready` flag — React's dev double-mount
  cancels a build done inside `.then()`.
- A **disabled** input is omitted from `FormData` entirely. Use `readOnly` when the server still
  needs the value.
- Seed data is not evidence. `scripts/seed-dev.mjs` invented "Nyati Estate Road, Kharadi", which no
  geocoder can find because it does not exist. Do not diagnose product bugs from it.

## Status
**All five MVPs built**, plus twenty-four migrations of product beyond them: owner self-verify,
contact exchange, shortlists, notifications, intent matching, visit feedback, price context, owner
replies, engagement counts, areas, visit scheduling, duplicate detection, scheduled jobs, email
delivery, and map pins. Running in **open mode** (auth gate off) against a **real Supabase project**
with fixtures available as a fallback. See `docs/ROADMAP.md` for what is still open — the headline
is that phone OTP needs a DLT-registered SMS provider before the auth gate can go back on, and
nothing has ever run with it on.

## Admin actions (MVP5) — two paths, keep them in step
`0005` ships five SECURITY DEFINER RPCs gated on `is_admin()`, which reads `auth.uid()`. Open mode
has no JWT (service-role ⇒ `auth.uid()` is null ⇒ every RPC raises `not authorized`), and fixtures
have no Postgres. So `src/lib/admin.ts` branches: authenticated → `supabase.rpc(...)`; sandbox →
the equivalent writes inline. **The SQL is the spec — change an RPC in `0005` and change its twin
in `admin.ts`.**
