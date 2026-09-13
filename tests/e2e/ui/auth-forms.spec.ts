import { expect, type Page, test } from "@playwright/test";

const NARROW = { width: 360, height: 760 };

/**
 * These forms do their validation in the client. Before hydration a submit
 * click falls through to a native form submission, so every interactive test
 * must wait for the form to report that it is interactive.
 */
async function gotoHydrated(page: Page, path: string) {
  await page.goto(path);
  await page.waitForSelector('form[data-hydrated="true"]');
}

/**
 * Next injects its own role="alert" route announcer, so an unfiltered
 * getByRole("alert") matches two elements under strict mode.
 */
function errorSummary(page: Page) {
  return page.getByRole("alert").filter({ hasText: "There is a problem" });
}

test.describe("authentication forms", () => {
  test("sign-in fits 360 px without horizontal overflow", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await gotoHydrated(page, "/sign-in");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );

    expect(overflow).toBe(false);
  });

  test("an empty submission summarises the errors and takes focus", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await gotoHydrated(page, "/sign-in");

    await page.getByRole("button", { name: "Sign in" }).click();

    const summary = errorSummary(page);
    await expect(summary).toBeVisible();
    await expect(summary).toBeFocused();
    await expect(summary.getByRole("link")).toHaveCount(2);
  });

  test("a summary link moves the caret to the field that failed", async ({ page }) => {
    await gotoHydrated(page, "/sign-in");
    await page.getByRole("button", { name: "Sign in" }).click();

    await page.getByRole("link", { name: "Enter your password." }).click();

    expect(await page.evaluate(() => document.activeElement?.id)).toBe("password");
  });

  test("the failing field is marked invalid and describes its error", async ({ page }) => {
    await gotoHydrated(page, "/sign-in");
    await page.getByRole("button", { name: "Sign in" }).click();

    const email = page.getByLabel(/Email address/);

    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(email).toHaveAttribute("aria-describedby", /email-error/);
  });

  test("the whole sign-in form is operable by keyboard alone", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await gotoHydrated(page, "/sign-in");

    const submit = page.getByRole("button", { name: "Sign in" });

    for (let press = 0; press < 15; press += 1) {
      await page.keyboard.press("Tab");
      if (await submit.evaluate((el) => el === document.activeElement)) {
        await page.keyboard.press("Enter");
        await expect(errorSummary(page)).toBeVisible();
        return;
      }
    }

    throw new Error("Sign in button was not reachable within 15 tab presses");
  });

  test("recovery does not disclose whether an account exists", async ({ page }) => {
    await gotoHydrated(page, "/recover");

    await page.getByLabel(/Email address/).fill("student@uitm.edu.my");
    await page.getByRole("button", { name: "Send recovery link" }).click();

    const result = page.getByRole("status");

    await expect(result).toContainText("If an account exists");
    await expect(result).not.toContainText("student@uitm.edu.my");
  });

  test("registration rejects a mismatched confirmation", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await gotoHydrated(page, "/sign-up");

    await page.getByLabel(/^Email address/).fill("student@uitm.edu.my");
    await page.getByLabel(/^Password/).fill("a-long-enough-passphrase");
    await page.getByLabel(/^Confirm password/).fill("a-different-passphrase");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.locator("#confirm-password-error")).toContainText("does not match");
  });

  test("every auth screen is marked as fixture data", async ({ page }) => {
    for (const path of ["/sign-in", "/sign-up", "/recover"]) {
      await page.goto(path);
      await expect(page.getByRole("note")).toContainText("Development only");
    }
  });
});
