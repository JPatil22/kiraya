import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end journeys, per role (tenant / owner / broker / admin).
 *
 * These run against the app in OPEN MODE + FIXTURES: no auth gate, the acting
 * role comes from a cookie, and data lives in an in-memory store instead of
 * Postgres. That combination is deliberate — it means the suite needs no
 * secrets, no database and no network, so it is hermetic and CI-safe. It
 * exercises the real routes, server actions and client code (including the
 * 0033 photo-thumbnail resize, which runs in a real browser here); what it does
 * NOT test is the RLS security boundary — that is `npm run verify:rls`, which
 * signs in with real JWTs against a real project. The two are complementary:
 * this proves the journeys work, verify:rls proves the database enforces them.
 *
 * A dedicated dev server is booted on 3100 so the suite never collides with a
 * normal `npm run dev` on 3000.
 */

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // Fixtures keep one shared in-memory store per server process, so writes from
  // parallel tests would interleave. One worker, ordered, keeps them honest.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `next dev -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Overrides win over .env.local in Next, so this forces fixtures + open mode
    // regardless of what a developer's local env is set to.
    env: {
      NEXT_PUBLIC_OPEN_MODE: "true",
      NEXT_PUBLIC_USE_FIXTURES: "true",
    },
  },
});
