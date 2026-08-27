import { test, expect } from "@playwright/test";
import { actAs, type DevRole } from "./helpers";

/**
 * The four things roles gate (0024), as a table: who reaches each surface and
 * who is bounced to their dashboard. This is the routing half of the story —
 * cheap, deterministic, and the first thing to break if a guard regresses.
 */

const ROLES: DevRole[] = ["tenant", "owner", "broker", "admin"];

const MATRIX: { path: string; allow: DevRole[]; note: string }[] = [
  { path: "/listings/new", allow: ["owner", "broker", "admin"], note: "posting needs canPost — owners, brokers and admins" },
  { path: "/broker/intents", allow: ["broker"], note: "suggestions are broker-only" },
  { path: "/admin", allow: ["admin"], note: "admin console is admin-only" },
  { path: "/intent", allow: ["tenant", "owner", "broker", "admin"], note: "saving an intent is open to all" },
];

for (const { path, allow, note } of MATRIX) {
  for (const role of ROLES) {
    const permitted = allow.includes(role);
    test(`${role} ${permitted ? "reaches" : "is redirected from"} ${path} (${note})`, async ({
      context,
      page,
    }) => {
      await actAs(context, role);
      const res = await page.goto(path, { waitUntil: "domcontentloaded" });
      // Never a server error, whichever way it goes.
      expect(res?.status() ?? 0).toBeLessThan(500);
      // goto follows redirects, so the final pathname is the real outcome.
      const landed = new URL(page.url()).pathname;
      if (permitted) {
        expect(landed).toBe(path);
      } else {
        expect(landed).not.toBe(path);
      }
    });
  }
}
