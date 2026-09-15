import { expect, test } from "@playwright/test";

const NARROW = { width: 360, height: 760 };

/**
 * The console is now server-loaded. What an anonymous visitor sees depends on
 * whether Supabase is configured for the run: without it the loader throws and
 * the queue reports itself unavailable; with it there is no session, so the
 * page asks the visitor to sign in. Both are refusals, and neither may leak
 * anything about what is waiting.
 *
 * The authorised queue, the evidence viewer and the decision paths are covered
 * by the component tests, which can drive every operation outcome. Proving the
 * authorised path end to end needs a seeded Sheriff role assignment, which is
 * backend test data rather than something this lane should create.
 *
 * A signed-in student being refused the queue is already proven end to end by
 * tests/e2e/identity/auth-flow.spec.ts, which asserts a 403 and NOT_AUTHORIZED
 * from the queue route. Registering another account here would spend the shared
 * Supabase mail budget to re-prove it.
 */
const REFUSAL_HEADING =
  /^(Sign in to open the console|This console is for Sheriffs|The review queue could not be loaded)$/;

test.describe("Sheriff Console", () => {
  test("refuses a viewer and says the server enforces it", async ({ page }) => {
    await page.goto("/console");

    await expect(page.getByRole("heading", { name: "Sheriff Console", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: REFUSAL_HEADING })).toBeVisible();
  });

  test("leaks nothing about what is waiting for review", async ({ page }) => {
    await page.goto("/console");

    await expect(page.getByRole("list", { name: /verification requests/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /view the evidence/i })).toHaveCount(0);
    await expect(page.getByLabel(/Reason code/)).toHaveCount(0);
    await expect(page.getByText(/waiting/i)).toHaveCount(0);
  });

  test("never exposes a storage path", async ({ page }) => {
    await page.goto("/console");

    const html = await page.content();

    expect(html).not.toContain("identity-evidence");
    expect(html).not.toMatch(/objectPath|object_path/);
  });

  test("no longer marks the screen as development fixture data", async ({ page }) => {
    await page.goto("/console");

    await expect(page.getByText("Development only")).toHaveCount(0);
  });

  test("does not advertise the console to a viewer whose role lacks it", async ({ page }) => {
    await page.goto("/profile");

    await expect(page.getByRole("link", { name: "Sheriff Console" })).toHaveCount(0);
  });

  test("fits 360 px without horizontal overflow", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto("/console");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );

    expect(overflow).toBe(false);
  });

  test("reveals the skip link on first tab and moves focus to main", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto("/console");

    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();

    await page.keyboard.press("Enter");

    expect(await page.evaluate(() => document.activeElement?.id)).toBe("main-content");
  });
});
