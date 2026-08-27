import type { BrowserContext } from "@playwright/test";

export type DevRole = "tenant" | "owner" | "broker" | "admin";

/** The seeded dev identities (scripts/seed-dev.mjs and the fixtures store). */
export const IDENTITY: Record<DevRole, { name: string; phone: string }> = {
  tenant: { name: "Ananya Rao", phone: "+919000000001" },
  owner: { name: "Suresh Kamath", phone: "+919000000002" },
  broker: { name: "Imran Sheikh", phone: "+919000000003" },
  admin: { name: "Kiraya Ops", phone: "+919000000004" },
};

/** An owner-owned, live seed listing — used for management and photo journeys. */
export const OWNER_LISTING_ID = "prop-5";

/**
 * Become a role by planting the same cookie the open-mode header switcher sets.
 * It is httpOnly and unsigned on purpose ("a cookie anybody can set"), so the
 * test writes it directly rather than clicking the switcher — which keeps role
 * setup out of every test body.
 */
export async function actAs(context: BrowserContext, role: DevRole) {
  await context.addCookies([
    {
      name: "kiraya_dev_role",
      value: role,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

/**
 * A 1×1 PNG — the smallest valid image the upload accepts. Enough to drive the
 * whole path: the browser decodes it, the client resize + thumbnail run, and
 * the server stores it. We don't assert on pixels, only that the journey works.
 */
export const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
