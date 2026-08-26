import type { UserRole } from "@/types/database";

/**
 * OPEN MODE — the pre-deployment sandbox.
 *
 * Phone OTP is deliberately deferred (a production India rollout needs a
 * DLT-registered SMS provider — see docs/PRD.md §8). Until then every route is
 * reachable without signing in, and the app acts as one of the seeded dev
 * identities below, whose role you switch from the site header.
 *
 * Fail-safe by design: this is OFF unless the env var says exactly "true", so
 * a deploy that simply doesn't set it gets the real auth gate back.
 *
 * ## Why the guard below exists
 *
 * "Fail-safe unless someone sets it" is not the same as safe. This repo has run
 * with the flag ON for its entire life, so the value that is already in
 * .env.local — and in any shell, CI variable or dashboard someone copies it
 * into — is `true`. The realistic accident is not forgetting to set it; it is
 * carrying the setting forward.
 *
 * And what it carries forward is total: the acting role comes from a cookie
 * anybody can set, and every read and write uses the service-role key, which
 * bypasses RLS. On a public URL that is not a degraded experience, it is the
 * absence of access control — a visitor picks "admin" in the header and can
 * approve listings, take them down, suspend brokers and read every profile.
 *
 * So in a production build it refuses to start rather than starting unsafely.
 * A deliberate private demo is still possible, but it has to say so out loud in
 * a second variable that nobody sets by accident.
 */
export const OPEN_MODE = process.env.NEXT_PUBLIC_OPEN_MODE === "true";

/** The deliberate escape hatch. Not NEXT_PUBLIC — this one is server-only. */
const OPEN_MODE_ALLOWED_IN_PRODUCTION =
  process.env.KIRAYA_ALLOW_OPEN_MODE_IN_PRODUCTION === "i-understand-this-disables-all-access-control";

/**
 * Runs at module load, so it fails the boot rather than the first request. Both
 * `next build` and `next start` set NODE_ENV=production, which means a broken
 * deploy is caught in the build log instead of by whoever finds the header
 * switcher first.
 */
if (
  process.env.NODE_ENV === "production" &&
  OPEN_MODE &&
  !OPEN_MODE_ALLOWED_IN_PRODUCTION
) {
  throw new Error(
    [
      "",
      "  Kiraya refused to start.",
      "",
      "  NEXT_PUBLIC_OPEN_MODE=true in a production build gives every visitor",
      "  administrator rights: the acting role is read from a cookie and all",
      "  database access uses the service-role key, which bypasses RLS.",
      "",
      "  Set NEXT_PUBLIC_OPEN_MODE=false — that is the real auth gate, and it",
      "  is what this app is meant to ship with.",
      "",
      "  If this really is a private demo with no real users, and you accept",
      "  that anyone with the URL is an admin, set:",
      "    KIRAYA_ALLOW_OPEN_MODE_IN_PRODUCTION=i-understand-this-disables-all-access-control",
      "",
    ].join("\n"),
  );
}

/**
 * True only when open mode is running somewhere it should not be. The UI uses
 * this to say so on every page, because a private demo that quietly became the
 * production URL is exactly the situation nobody notices.
 */
export const OPEN_MODE_IN_PRODUCTION =
  process.env.NODE_ENV === "production" && OPEN_MODE;

/**
 * UI-only mode: serve every query from in-memory fixtures instead of Postgres,
 * so the whole app can be clicked through with no database at all.
 *
 * What this cannot show you is everything enforced in SQL — RLS, the
 * `properties_guard` publish/verify guard, the `log_property_changes` audit
 * trigger, `v_listings_public`, and the constraints. Treat a green walkthrough
 * here as "the screens render", not "the product works".
 */
export const USE_FIXTURES = process.env.NEXT_PUBLIC_USE_FIXTURES === "true";

/** Cookie holding the role the sandbox is currently acting as. */
export const DEV_ROLE_COOKIE = "kiraya_dev_role";

/**
 * Request header the middleware stamps with the current path, so the role
 * switcher can send you back to the page you were on. A cookie written in a
 * server action isn't visible to that same request's render, so switching roles
 * has to round-trip through a redirect rather than a revalidate.
 */
export const DEV_PATH_HEADER = "x-kiraya-path";

export const DEV_ROLES = ["tenant", "owner", "broker", "admin"] as const;

export const DEFAULT_DEV_ROLE: UserRole = "tenant";

/**
 * Well-known phone numbers for the four seeded dev identities. The app resolves
 * the acting profile by looking one of these up, so no user id is hardcoded —
 * `npm run db:seed` can recreate them against any project.
 */
export const DEV_PHONES: Record<UserRole, string> = {
  tenant: "+919000000001",
  owner: "+919000000002",
  broker: "+919000000003",
  admin: "+919000000004",
};

export function isDevRole(value: unknown): value is UserRole {
  return typeof value === "string" && (DEV_ROLES as readonly string[]).includes(value);
}
