import { expect, type Page, test } from "@playwright/test";

// Primary flows must work from 360 px upward and be operable by keyboard
// (context/ui-context.md, Accessibility and Responsive Requirements).
const NARROW = { width: 360, height: 760 };

/**
 * `/profile` is server-loaded from the identity module and guarded, so what an
 * anonymous visitor gets depends on whether Supabase is configured for the run:
 * without configuration the loader throws, the guard deliberately does not
 * redirect an outage, and the page reports that accounts are unavailable; with
 * it, there is no session, so the guard sends the visitor to sign in and
 * remembers where they were going.
 *
 * These specs assert what is true of both, which keeps the gate meaningful
 * whether or not the stack happens to be reachable. The signed-in account
 * itself is covered by component tests, which can construct every trust
 * combination without a session.
 */
const REFUSAL_HEADING = /^(Sign in|Your account could not be loaded)$/;
const REFUSAL_ACTION = /^(Sign in|Try again)$/;

/** True when the guard sent the visitor to sign in rather than refusing in place. */
function wasGuarded(page: Page): boolean {
  return new URL(page.url()).pathname === "/sign-in";
}

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
    // The guard's redirect completes in the browser, so the landing URL is not
    // settled until the navigation is.
    await page.waitForLoadState("networkidle");

    if (wasGuarded(page)) {
      // Remembering the destination is what makes the redirect acceptable:
      // signing in returns the viewer to the profile they asked for.
      expect(new URL(page.url()).searchParams.get("next")).toBe("/profile");
      await expect(page.getByRole("heading", { name: "Sign in", level: 1 })).toBeVisible();
      return;
    }

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
    await page.waitForLoadState("networkidle");

    await page.keyboard.press("Tab");

    const skipLink = page.getByRole("link", { name: "Skip to content" });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeInViewport();

    await page.keyboard.press("Enter");

    const focusedId = await page.evaluate(() => document.activeElement?.id);
    expect(focusedId).toBe("main-content");
  });

  /**
   * Whichever screen the visitor lands on, the one action that moves them
   * forward has to be focusable and visibly focused. Guarded, that action is
   * the sign-in form's submit; refused in place, it is the recovery link.
   */
  function recoveryAction(page: Page) {
    return wasGuarded(page)
      ? page.getByRole("button", { name: /Sign in/ })
      : page.locator("main").getByRole("link", { name: REFUSAL_ACTION });
  }

  test("gives the focused recovery action a visible focus ring", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto("/profile");
    await page.waitForLoadState("networkidle");

    const action = recoveryAction(page);
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
    await page.waitForLoadState("networkidle");

    const action = recoveryAction(page);

    for (let press = 0; press < 14; press += 1) {
      await page.keyboard.press("Tab");
      if (await action.evaluate((el) => el === document.activeElement)) {
        return;
      }
    }

    throw new Error("Recovery action was not reachable within 14 tab presses");
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
