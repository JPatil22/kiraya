import { test, expect } from "@playwright/test";
import { actAs } from "./helpers";

/**
 * Admin-only surfaces beyond the routing matrix. Here: the seed-sources page
 * (0034), which groups private listing sources by number.
 */

test.describe("admin", () => {
  test.beforeEach(async ({ context }) => {
    await actAs(context, "admin");
  });

  test("reaches the seed-sources page", async ({ page }) => {
    await page.goto("/admin/sources");
    await expect(page).toHaveURL(/\/admin\/sources$/);
    await expect(page.getByRole("heading", { name: /seed sources/i })).toBeVisible();
  });
});

test("a non-admin is redirected from the seed-sources page", async ({ context, page }) => {
  await actAs(context, "owner");
  await page.goto("/admin/sources");
  await expect(page).not.toHaveURL(/\/admin\/sources$/);
});
