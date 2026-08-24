# CLAUDE.md — Kiraya

Tenant-first rental platform for **one Indian locality**. Optimises for listing **truth**
(freshness, transparent cost, authorship) over listing volume. See `docs/PRD.md`.

**Launch market: Pune** (`NEXT_PUBLIC_ACTIVE_LOCALITY_SLUG=pune`, seeded by `0007`). Note this
uses a whole *city* as the single `locality` row — a deliberate departure from the PRD's
"win one neighbourhood" bet. There is no sub-area filter, so the feed spans all of Pune.
Adding an area dimension is tracked in `docs/ROADMAP.md`.

## Stack
- **Next.js** (App Router, RSC, Server Actions) + TypeScript
- **Supabase** (Postgres, Auth phone-OTP, RLS) via `@supabase/ssr`
- **Tailwind** v3 + **shadcn/ui** (new-york, slate)

## Layout
```
docs/                 PRD, SCHEMA, FLOWS, ROADMAP  ← read these first
supabase/migrations/  0001…0005 one per MVP, 0006 listing photos (+ Storage bucket)
src/app/              routes (App Router)
src/lib/supabase/     client.ts (browser) · server.ts (RSC/actions) · middleware.ts (session)
src/lib/validators.ts zod schemas shared by forms + server actions
src/components/ui/     shadcn primitives
src/middleware.ts     auth + onboarding-step routing guard
```

## Conventions
- **Money is integer rupees**, stored as separate cost components — never a single blurred price.
- **Photos carry their own `captured_at`**, separate from `last_verified_at`. A fresh verification
  next to an old photo is a mismatch the UI must surface, not hide (`src/lib/photos.ts`).
- **Everything has an author + timestamp.** New user-data tables get `created_by`/`created_at`.
- **RLS is the security boundary**, not the app. Every new table ships with policies in its migration.
  Admin checks go through `public.is_admin()` (SECURITY DEFINER) to avoid `profiles` RLS recursion.
- Onboarding routing is driven by `profiles.onboarding_step` (`role`→`intent`→`done`) in middleware.
- Only `listing_status = 'live'` properties are tenant-visible; read them via `v_listings_public`.
- **No Aadhaar / government KYC.** Phone verification is the identity bar. Do not add document upload.
- Single locality: assume `NEXT_PUBLIC_ACTIVE_LOCALITY_SLUG` everywhere; no city switcher.
- **Never call `supabase.auth.getUser()` in a page or action.** Go through `getSessionUser()` /
  `getDataClient()` in `src/lib/auth.ts` — that's the seam open mode swaps out.

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
  Also switched inside `getDataClient()`. New queries must use only the builder methods the fixture
  client implements (select/eq/neq/gte/lte/order/limit/maybeSingle/single/insert) or extend it.
  Fixture writes live on a `globalThis` store on purpose — Next instantiates modules separately in
  the RSC and Server Action layers, so plain module state silently loses writes.

## Commands
- `npm run dev` — dev server
- `npm run typecheck` — `tsc --noEmit`
- `npm run db:push` / `db:reset` — apply migrations (needs Supabase CLI + linked project)
- `npm run db:seed` — dev identities + sample listings for open mode (idempotent, service-role)
- `npm run verify:rls` — sign in as each dev identity with a **real JWT** and assert what RLS, the
  `properties_guard` trigger and the admin RPCs actually allow. Open mode uses service-role, so
  this is the only thing that exercises the security boundary. Run it after touching any policy.
- `npm run db:types` — regenerate `src/types/database.ts` from the local DB

## Gotchas
- `@supabase/ssr` and `@supabase/supabase-js` must be a compatible pair (currently `^0.12` + `^2.112`).
- Row types in `src/types/database.ts` must be **`type` aliases, not `interface`s** — supabase-js
  needs `Row extends Record<string, unknown>`, and interfaces lack an implicit index signature,
  which silently collapses every query result to `never`.
- The `properties_guard` trigger deliberately passes through when `auth.uid()` is null (direct DB /
  service_role); RLS already blocks anon writes, so it only constrains authenticated non-admins.

## Status
**All five MVPs built** (identity+intent · verified listings · history+mismatch · broker
suggestions · admin panel). Running in **open mode** (auth gate off) and on **fixtures** (no DB)
until deploy. Nothing has yet run against real Postgres. See `docs/ROADMAP.md`.

## Admin actions (MVP5) — two paths, keep them in step
`0005` ships five SECURITY DEFINER RPCs gated on `is_admin()`, which reads `auth.uid()`. Open mode
has no JWT (service-role ⇒ `auth.uid()` is null ⇒ every RPC raises `not authorized`), and fixtures
have no Postgres. So `src/lib/admin.ts` branches: authenticated → `supabase.rpc(...)`; sandbox →
the equivalent writes inline. **The SQL is the spec — change an RPC in `0005` and change its twin
in `admin.ts`.**
