import { expect, type Page, test } from "@playwright/test";

const NARROW = { width: 360, height: 760 };

async function gotoHydrated(page: Page, path: string) {
  await page.goto(path);
  await page.waitForSelector('form[data-hydrated="true"]');
}

test.describe("institution verification", () => {
  test("is reachable from the profile restriction notice", async ({ page }) => {
    await page.goto("/profile");

    const response = await page.goto("/profile/institution-verification");

    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Institution verification" })).toBeVisible();
  });

  test("fits 360 px without horizontal overflow", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await gotoHydrated(page, "/profile/institution-verification");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );

    expect(overflow).toBe(false);
  });

  test("states who sees the evidence and how long it is kept", async ({ page }) => {
    await gotoHydrated(page, "/profile/institution-verification");

    const privacy = page.getByRole("note", { name: "How your evidence is handled" });

    await expect(privacy).toBeVisible();
    await expect(privacy).toContainText("30 days");
    await expect(privacy).toContainText("Sheriff");
  });

  test("does not present an unconfirmed domain as approved", async ({ page }) => {
    await gotoHydrated(page, "/profile/institution-verification");

    await expect(page.getByText(/has not been published yet/i)).toBeVisible();
  });

  test("refuses an incomplete request and links each problem to its field", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await gotoHydrated(page, "/profile/institution-verification");

    await page.getByRole("button", { name: "Request verification" }).click();

    const summary = page.getByRole("alert").filter({ hasText: "There is a problem" });

    await expect(summary).toBeVisible();
    await expect(summary).toBeFocused();
    await expect(summary.getByRole("link")).toHaveCount(2);

    await expect(page.locator("#evidence-error")).toContainText("Choose a file");
    await expect(page.locator("#declaration-error")).toContainText("Confirm");
  });

  test("the declaration checkbox is operable by keyboard", async ({ page }) => {
    await gotoHydrated(page, "/profile/institution-verification");

    const declaration = page.locator("#declaration");

    await declaration.focus();
    await page.keyboard.press("Space");

    await expect(declaration).toBeChecked();
  });
});
