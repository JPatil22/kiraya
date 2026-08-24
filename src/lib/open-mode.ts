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
 */
export const OPEN_MODE = process.env.NEXT_PUBLIC_OPEN_MODE === "true";

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
