# Kiraya — Deploying

Written as a checklist because three of these fail **silently**: maps that never
render, Google sign-in that loops, emails that vanish. None of them raise an
error you would notice from the outside.

---

## 0. Before you deploy anything

**Run the authenticated path locally first.** Every request this app has ever
served took the open-mode branch. `NEXT_PUBLIC_OPEN_MODE=false` has never
executed, which means RLS becomes the live boundary and `getDataClient()`
returns a session client for the first time.

```bash
echo 'NEXT_PUBLIC_OPEN_MODE=false' > .env.development.local
npm run dev
```

Sign in with Google, walk role → phone → intent → dashboard, post a listing,
approve it as admin, unlock a contact. Whatever breaks here would otherwise have
broken in public, on the day you told people about it. Delete
`.env.development.local` afterwards.

**Apply every pending migration.** Check the highest `_NNNN_apply.sql` in
`supabase/migrations/` against what the database has. A page whose view is
missing renders nothing and — since the read-error logging landed — says so in
the server log, but only if somebody is reading it.

---

## 1. Environment variables

All of these go in Vercel → Settings → Environment Variables. `NEXT_PUBLIC_*`
are compiled into the browser bundle; everything else stays server-side.

| Variable | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | your project URL | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key | safe in the browser by design |
| `SUPABASE_SERVICE_ROLE_KEY` | service key | **never** prefix with `NEXT_PUBLIC` |
| `NEXT_PUBLIC_ACTIVE_LOCALITY_SLUG` | `pune` | |
| `NEXT_PUBLIC_VERIFY_STALE_DAYS` | `7` | |
| `NEXT_PUBLIC_OPEN_MODE` | `false` | the build **refuses to start** on `true` |
| `NEXT_PUBLIC_USE_FIXTURES` | `false` | |
| `NEXT_PUBLIC_SITE_URL` | `https://your-domain` | see below — this one matters |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Maps key | referrer-restricted, see §3 |
| `RESEND_API_KEY` | Resend key | |
| `KIRAYA_EMAIL_FROM` | `Kiraya <hello@your-domain>` | needs a verified domain, §4 |
| `KIRAYA_CRON_SECRET` | `openssl rand -hex 24` | delivery is off without it |

**`NEXT_PUBLIC_SITE_URL` is load-bearing.** OAuth returns to it and email links
point at it. Without it the code falls back to `VERCEL_URL`, which is the
deployment's own hostname — so a preview build would send people to the preview
and a production build to whichever hostname Vercel picked. Set it explicitly to
your real domain.

---

## 2. Supabase

**Authentication → URL Configuration → Redirect URLs** — add:

```
https://your-domain/auth/callback
```

Without it Google sign-in completes at Google, comes back to Supabase, and is
refused at the last hop. The user lands on `/login` looking like nothing
happened.

Keep `http://localhost:3000/auth/callback` in the list so local development
keeps working.

---

## 3. Google Cloud

**APIs & Services → Credentials → your Maps key → HTTP referrers** — add:

```
https://your-domain/*
```

Miss this and every map is blank in production while working perfectly on your
machine, because the key is restricted to `localhost`.

Also set a **quota cap** per API. India's free tier is generous — order of 70k
Essentials calls a month, roughly 2,300 listing views a day — but the free tier
is a discount, not a ceiling, and a key that ships to the browser is a spending
liability without one.

The **OAuth** client is separate and already points at Supabase's callback, not
yours; it does not change when you deploy.

---

## 4. Resend

Verify a sending domain and set `KIRAYA_EMAIL_FROM` to an address on it. The
shared `onboarding@resend.dev` sender only delivers to the address that owns the
API key — so in production every notification email to a real tenant or owner
fails, and the delivery run reports success because Resend accepted it.

---

## 5. Delivery schedule

`vercel.json` registers a cron hitting `/api/notifications/deliver` **once a
day**, at 03:00 UTC — 08:30 IST, just after the freshness sweep and visit
reminders.

Daily because that is the Hobby plan's ceiling: it permits two cron jobs and
runs them once per day, and a sub-daily expression is **rejected at deploy**,
which would fail the whole deployment rather than merely scheduling less often.

On Pro, change it to `*/15 * * * *`. Fifteen minutes is the cadence this route
was built for — the digest then holds whatever accumulated in the window, which
is usually one thing, and a contact request does not wait until tomorrow morning
for its email.

The route accepts either `KIRAYA_CRON_SECRET` or Vercel's own `CRON_SECRET`, so
setting just one of them is enough.

This is the piece that could not exist locally: `pg_net` cannot reach
`localhost`, so until there is a public URL nothing calls the route and every
notification stays in-app.

Confirm the database half is scheduled too:

```sql
select jobname, schedule, active from cron.job where jobname like 'kiraya-%';
```

Two rows at `30 2 * * *` and `45 2 * * *` — 08:00 and 08:15 IST. If it is empty,
enable `pg_cron` under Database → Extensions and re-run `_0025_apply.sql`.

---

## 6. Licence

Vercel's Hobby plan is licensed for **non-commercial use only**. A rental
platform with real listings is commercial; that means Pro.

---

## 7. After the first deploy

Walk it in production, in this order, because each step depends on the last:

1. `/listings` loads and the map renders on a listing → §3 is right
2. Google sign-in completes and lands on onboarding → §2 is right
3. Post a listing, approve it as admin → the auth path and the admin RPCs are
   executing for real, most likely for the first time
4. Wait for a cron tick, or `curl -X POST -H "Authorization: Bearer $SECRET"
   https://your-domain/api/notifications/deliver` → §4 and §5 are right

If a page renders empty rather than erroring, check the Vercel function logs for
`[db:read]` — failing reads name themselves there rather than pretending to be
an empty result.
