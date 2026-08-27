import { test, expect } from "@playwright/test";
import { actAs } from "./helpers";

/**
 * The broker journey: unlike an owner, a broker must state a fee to post, and
 * is the only role that can suggest listings into a tenant's intent.
 */

test.describe("broker", () => {
  test.beforeEach(async ({ context }) => {
    await actAs(context, "broker");
  });

  test("post form requires stating brokerage (0023)", async ({ page }) => {
    await page.goto("/listings/new");
    // An editable numeric fee — the opposite of the owner's hidden zero.
    await expect(page.locator('input[name="brokerage"][inputmode="numeric"]')).toBeVisible();
    // ...plus the explicit "No brokerage" declaration, so zero is stated, never assumed.
    await expect(page.locator('input[name="brokerageNone"]')).toHaveCount(1);
  });

  test("reaches the suggestion surface", async ({ page }) => {
    await page.goto("/broker/intents");
    await expect(page).toHaveURL(/\/broker\/intents$/);
    await expect(page.getByText(/suggest a listing/i)).toBeVisible();
  });
});
