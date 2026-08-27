import { test, expect } from "@playwright/test";
import { actAs, OWNER_LISTING_ID, TINY_PNG } from "./helpers";

/**
 * The owner journey: post without a brokerage fee, manage your own listing,
 * add a photo. The photo test drives the real upload — client resize and the
 * 0033 thumbnail both run in the browser, then the server stores the result.
 */

test.describe("owner", () => {
  test.beforeEach(async ({ context }) => {
    await actAs(context, "owner");
  });

  test("post form carries no brokerage control (0023)", async ({ page }) => {
    await page.goto("/listings/new");
    await expect(page.getByText(/posting as the owner/i)).toBeVisible();
    // Brokerage is a hidden input fixed at 0 — there is no field to type a fee.
    await expect(
      page.locator('input[name="brokerage"]:not([type="hidden"])'),
    ).toHaveCount(0);
  });

  test("cannot reach the broker suggestion surface", async ({ page }) => {
    await page.goto("/broker/intents");
    await expect(page).not.toHaveURL(/\/broker\/intents$/);
  });

  test("can add a photo to their own listing", async ({ page }) => {
    await page.goto(`/listings/${OWNER_LISTING_ID}/photos`);

    // Work within one room slot's form. Scoping matters: choosing a file flips
    // THIS slot's button to "Preparing…", and a page-wide "Add photo" match
    // would then land on a different, still-empty slot.
    const slot = page.locator('form:has(input[name="photo"])').first();

    // Choosing a file kicks off the client-side downscale + thumbnail (0033);
    // the button reads "Preparing…" until they finish, so matching on its
    // name auto-waits for the resize before clicking.
    await slot
      .locator('input[name="photo"]')
      .setInputFiles({ name: "room.png", mimeType: "image/png", buffer: TINY_PNG });

    await slot.getByRole("button", { name: /add photo|replace/i }).click();

    await expect(page.getByText(/photo added|photo replaced/i)).toBeVisible();
  });
});
