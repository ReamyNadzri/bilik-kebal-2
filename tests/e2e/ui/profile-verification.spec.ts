import { expect, test } from "@playwright/test";

// Primary flows must work from 360 px upward and be operable by keyboard
// (context/ui-context.md, Accessibility and Responsive Requirements).
const NARROW = { width: 360, height: 760 };

/**
 * `/profile` is now server-loaded from the identity module, so what an
 * anonymous visitor sees depends on whether Supabase is configured for the run:
 * without configuration the loader throws and the page reports that accounts
 * are unavailable; with it, the loader returns no session and the page asks the
 * visitor to sign in.
 *
 * These specs assert what is true of both, which keeps the gate meaningful
 * whether or not the local stack happens to be running. The signed-in account
 * itself is covered by component tests, which can construct every trust
 * combination without a session.
 */
const REFUSAL_HEADING = /^(Sign in to see your account|Your account could not be loaded)$/;
const REFUSAL_ACTION = /^(Sign in|Try again)$/;

test.describe("profile verification status", () => {
  test("fits 360 px without horizontal overflow", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto("/profile");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );

    expect(overflow).toBe(false);
  });

  test("explains why no account is shown rather than rendering an empty page", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto("/profile");

    await expect(page.getByRole("heading", { name: "Profile", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: REFUSAL_HEADING })).toBeVisible();
  });

  /**
   * The screen consumed its operation in this slice, so the development
   * fixture marker was removed with it. Its continued absence is the proof
   * that no fixture data is being presented as real.
   */
  test("no longer marks the screen as development fixture data", async ({ page }) => {
    await page.goto("/profile");

    await expect(page.getByRole("note")).toHaveCount(0);
    await expect(page.getByText("Development only")).toHaveCount(0);
  });

  test("shows no account data at all when there is no account to show", async ({ page }) => {
    await page.goto("/profile");

    // The fixture used to assert these; they must not appear for an anonymous
    // visitor now that the screen is real.
    await expect(page.getByText("Email Verified")).toHaveCount(0);
    await expect(page.getByRole("list", { name: "Account capabilities" })).toHaveCount(0);
  });

  test("reveals the skip link on first tab and moves focus to main", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto("/profile");

    await page.keyboard.press("Tab");

    const skipLink = page.getByRole("link", { name: "Skip to content" });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeInViewport();

    await page.keyboard.press("Enter");

    const focusedId = await page.evaluate(() => document.activeElement?.id);
    expect(focusedId).toBe("main-content");
  });

  test("gives the focused recovery action a visible focus ring", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto("/profile");

    const action = page.getByRole("link", { name: REFUSAL_ACTION });
    await action.focus();
    await expect(action).toBeFocused();

    const outline = await action.evaluate((el) => {
      const style = getComputedStyle(el);
      return { width: style.outlineWidth, style: style.outlineStyle };
    });

    expect(outline.style).not.toBe("none");
    expect(parseFloat(outline.width)).toBeGreaterThan(0);
  });

  test("reaches the recovery action by keyboard alone", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto("/profile");

    const action = page.getByRole("link", { name: REFUSAL_ACTION });

    for (let press = 0; press < 12; press += 1) {
      await page.keyboard.press("Tab");
      if (await action.evaluate((el) => el === document.activeElement)) {
        return;
      }
    }

    throw new Error("Recovery action was not reachable within 12 tab presses");
  });

  /**
   * Next injects its own route announcer with role="alert", so an unfiltered
   * query matches it too. Scoping to `main` keeps the assertion about this
   * page: at most one interrupting announcement per render.
   */
  test("never queues more than one interrupting announcement", async ({ page }) => {
    await page.goto("/profile");

    const alerts = page.locator("main [role='alert']");

    expect(await alerts.count()).toBeLessThanOrEqual(1);
  });
});
