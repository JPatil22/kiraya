# Kiraya — tenant-first rentals for one locality

Verified tenants · fresh availability · transparent history. Built to optimise for the **truth**
of a listing, not the **volume** of listings.

- **Product:** [`docs/PRD.md`](docs/PRD.md)
- **Data model:** [`docs/SCHEMA.md`](docs/SCHEMA.md)
- **Flows:** [`docs/FLOWS.md`](docs/FLOWS.md)
- **Roadmap / status:** [`docs/ROADMAP.md`](docs/ROADMAP.md)

**Stack:** Next.js (App Router, RSC, Server Actions) · Supabase (Postgres, phone-OTP auth, RLS) ·
Tailwind · shadcn/ui.

> **Current status: all five MVPs shipped** — phone OTP, role selection and tenant intent (no
> Aadhaar); verified listings with freshness, itemised cost and posted-by attribution; the update
> timeline and tenant mismatch reporting; in-app broker suggestions replacing the WhatsApp blast;
> and the admin cockpit (review queue, re-verification, mismatch triage, suspension, locality
> health). Plus listing photos (`0006`), where each photo carries its **own capture date** so a
> fresh verification can't launder a two-year-old picture. The whole loop now runs end to end.
>
> **Not yet proven against real Postgres** — see [open mode](#open-mode-no-sign-in) and the
> fixtures note below.
>
> **The app currently runs in [open mode](#open-mode-no-sign-in)** — the auth gate is off until
> we deploy, so the whole product is walk-through-able without an SMS provider.

---

## Just want to look at it? (no database)

```bash
npm install
npm run dev
```

`.env.local` ships with `NEXT_PUBLIC_USE_FIXTURES=true`, which serves every query from in-memory
sample data ([`src/lib/fixtures`](src/lib/fixtures)) — six listings covering fresh, stale,
never-verified, mismatch-warned and in-review, plus the five dev identities. Posting a listing
works and shows up as "In review"; it resets when the dev server restarts.

**What this proves and what it doesn't.** It renders every screen. It does *not* exercise RLS,
the `properties_guard` publish/verify guard, the `log_property_changes` audit trigger,
`v_listings_public`, or a single constraint — i.e. roughly half of this product, which lives in
SQL. Treat a clean walkthrough as "the UI works", not "the product works", and set
`NEXT_PUBLIC_USE_FIXTURES=false` as soon as a real database is linked.

## Prerequisites

- Node 20+ (repo built on Node 22)
- A Supabase project — either **local** (via the [Supabase CLI](https://supabase.com/docs/guides/cli),
  recommended for dev) or a **hosted** project.

## 1. Install & configure

```bash
npm install
cp .env.example .env.local
```

Fill `.env.local` with your Supabase URL + anon key (Project Settings → API).

## 2. Set up the database

### Option A — Local Supabase (recommended for dev)

```bash
supabase start           # boots Postgres, Auth, Studio locally
supabase db reset        # applies supabase/migrations/0001…0005 + seeds the locality
```

`supabase start` prints your local `API URL` and `anon key` — put those in `.env.local`.

**Phone OTP works with zero SMS cost locally** thanks to fixed test codes in
[`supabase/config.toml`](supabase/config.toml):

| Phone (enter without +91) | Code |
| --- | --- |
| `9000000001` | `123456` |
| `9000000002` | `123456` |
| `9000000003` | `123456` |

### Option B — Hosted Supabase

```bash
supabase link --project-ref <your-ref>
supabase db push         # applies the migrations to your hosted DB
```

Then in the **Supabase Dashboard → Authentication → Providers → Phone**, enable phone auth and
connect an SMS provider. **For India this provider must be DLT-registered (TRAI)** — see
[`docs/PRD.md`](docs/PRD.md) §8. Set the same locality slug in `.env.local`
(`NEXT_PUBLIC_ACTIVE_LOCALITY_SLUG`, default `pune`, seeded by `0007`).

## 3. Seed the sandbox

```bash
npm run db:seed
```

Creates the five dev identities and six sample listings that between them cover every trust state
the UI renders: fresh, stale, never-verified, mismatch-warned and in-review. Idempotent — re-run it
any time. Needs `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.

## 4. Run

```bash
npm run dev
```

Open http://localhost:3000.

## Open mode (no sign-in)

Phone OTP is deferred until deployment — a real India rollout needs a DLT-registered SMS provider
(see [`docs/PRD.md`](docs/PRD.md) §8), and that shouldn't block building MVP3–5. So while

```
NEXT_PUBLIC_OPEN_MODE=true
```

is set, **every route is reachable without signing in.** The app acts as one of the seeded dev
identities, and you switch which one from the **Acting as** control in the site header:

| Acting as | Seeded profile | What it unlocks |
| --- | --- | --- |
| `tenant` | Ananya Rao (`+919000000001`) | Intent card on the dashboard, browsing the feed |
| `owner` | Suresh Kamath (`+919000000002`) | **Post a property**, own-listings dashboard |
| `broker` | Imran Sheikh (`+919000000003`) | Same as owner, badged as a broker |
| `admin` | Kiraya Ops (`+919000000004`) | Everything (the MVP5 panel itself is still pending) |

How it works, and what it does **not** weaken:

- The acting role lives in a `kiraya_dev_role` cookie, set by a server action that is a no-op
  unless open mode is on — so it can't become an escalation path in a real deployment.
- `/login`, `/verify` and `/onboarding/*` redirect to `/dashboard`; the OTP funnel is dormant, not
  deleted. Every one of those flows still works when the flag comes off.
- With no session, `auth.uid()` is null and RLS would hide everything but `live` listings, so
  server-side reads and writes go through the **service-role** client
  ([`getDataClient()`](src/lib/auth.ts)). RLS policies themselves are untouched — they simply
  aren't the thing being exercised while open mode is on.

**Turning it off is one line:** delete `NEXT_PUBLIC_OPEN_MODE` from the environment (or set it to
anything other than `true`) and the phone-OTP gate, the onboarding state machine and full RLS
enforcement all come back. It is off by default, so a deploy that forgets to set it is safe rather
than wide open.

### The OTP flow (when open mode is off)

Open http://localhost:3000 → **Get started** → phone → OTP → pick a role → (tenant) intent form →
dashboard. Locally, use one of the test numbers above with code `123456` — no SMS cost.

### Make yourself an admin (for MVP5 later)

Roles `tenant/owner/broker` are self-selected; `admin` is granted directly in the DB:

```sql
update public.profiles set role = 'admin', onboarding_step = 'done'
where phone = '+919000000001';
```

### Seeing a listing go live

Publishing and verification are **admin-only**, enforced by a DB trigger — a poster can never mark
their own listing live or "verified". The full loop now runs in the app:

1. Act as an **owner** or **broker** → **Post a property** → it lands in `pending_review`.
2. Switch to **admin** → **Admin → Listings** → **Approve & verify**.
3. Open `/listings` — it appears, badged **Verified today**, and the listing's own update timeline
   shows both the status change and the verification, logged by the trigger.

To watch a listing go stale, backdate the stamp past the locality's window (default 7 days):

```sql
update public.properties set last_verified_at = now() - interval '12 days' where status = 'live';
```

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | Next.js ESLint |
| `npm run db:reset` | Reapply all migrations locally (destroys local data) |
| `npm run db:push` | Push migrations to the linked project |
| `npm run db:seed` | Create the open-mode dev identities + sample listings (idempotent) |
| `npm run db:types` | Regenerate `src/types/database.ts` from the local DB |

## How MVP1 fits together

```
/login  ──sendOtp──▶  /verify  ──verifyOtp──▶  profiles.onboarding_step
                                                   │
                     middleware.ts routes on step  ▼
                    role ─▶ /onboarding/role ─▶ intent ─▶ /onboarding/intent ─▶ done ─▶ /dashboard
```

- **Auth + onboarding routing:** [`src/middleware.ts`](src/middleware.ts)
- **Server actions:** [`src/app/(auth)/actions.ts`](src/app/%28auth%29/actions.ts),
  [`src/app/onboarding/actions.ts`](src/app/onboarding/actions.ts)
- **Validation (shared client + server):** [`src/lib/validators.ts`](src/lib/validators.ts)
- **RLS + schema:** [`supabase/migrations/0001_core_mvp1.sql`](supabase/migrations/0001_core_mvp1.sql)

Security note: the DB is the boundary. Row Level Security is enabled on every table, admin checks
go through `public.is_admin()`, and users can't self-promote to `admin`. Don't rely on the UI for access control.
