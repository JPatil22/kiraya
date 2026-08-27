import { test, expect } from "@playwright/test";
import { actAs, IDENTITY, OWNER_LISTING_ID } from "./helpers";

/**
 * The tenant journey: browse, ask for a number, save what you're after. The
 * contact unlock is the one that matters most — it is the trust mechanism the
 * whole product rests on, and it had never run end to end before this suite.
 */

test.describe("tenant", () => {
  test.beforeEach(async ({ context }) => {
    await actAs(context, "tenant");
  });

  test("gets a seeker dashboard, not a poster's", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText(/your rental intent/i)).toBeVisible();
    // A tenant cannot post, so there is no "Your listings" section.
    await expect(page.getByText("Your listings", { exact: true })).toHaveCount(0);
  });

  test("can browse the feed", async ({ page }) => {
    await page.goto("/listings");
    await expect(page.getByRole("heading", { name: /rentals in pune/i })).toBeVisible();
    await expect(page.locator('a[href^="/listings/"]').first()).toBeVisible();
  });

  test("can unlock an owner's contact number", async ({ page }) => {
    await page.goto(`/listings/${OWNER_LISTING_ID}`);

    // A prior run in the same server process may already have unlocked it, in
    // which case the number is shown straight away and there is no button.
    const button = page.getByRole("button", { name: /get contact details/i });
    if (await button.count()) {
      await button.click();
    }

    // However it is formatted on screen, the tel: link carries the raw digits.
    await expect(page.locator('a[href^="tel:"]').first()).toBeVisible();
    await expect(page.getByText(IDENTITY.owner.phone)).toBeVisible();
  });

  test("can save a rental intent", async ({ page }) => {
    await page.goto("/intent");
    await page.getByLabel(/min budget/i).fill("15000");
    await page.getByLabel(/max budget/i).fill("25000");
    // bhk, furnishing, occupancy and the move-in date all carry valid defaults.
    await page.locator('form:has(input[name="budgetMax"]) button[type="submit"]').click();
    // Success routes away from the empty form — to the dashboard or the saved intent.
    await expect(page).toHaveURL(/\/(dashboard|intent)/);
    await expect(page.getByText(/error|enter a number|must be/i)).toHaveCount(0);
  });
});
