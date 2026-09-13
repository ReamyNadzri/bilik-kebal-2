import { expect, test } from "@playwright/test";

// Primary flows must work from 360 px upward and be operable by keyboard
// (context/ui-context.md, Accessibility and Responsive Requirements).
const NARROW = { width: 360, height: 760 };

test.describe("profile verification status", () => {
  test("fits 360 px without horizontal overflow", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto("/profile");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );

    expect(overflow).toBe(false);
  });

  test("shows both trust states and the restriction at 360 px", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto("/profile");

    await expect(page.getByText("Email Verified")).toBeVisible();
    await expect(page.getByText("Institution Not Verified")).toBeVisible();

    // Filtered: Next injects its own role="alert" route announcer.
    const restriction = page.getByRole("alert").filter({ hasText: "Restricted" });
    await expect(restriction).toBeVisible();
    await expect(restriction).toContainText("institution verification");
  });

  test("states every capability in words at 360 px", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto("/profile");

    const capabilities = page.getByRole("list", { name: "Account capabilities" });

    // Exact: Playwright matches substrings, so "Allowed" would also match
    // "Not allowed".
    await expect(capabilities.getByText("Allowed", { exact: true })).toHaveCount(1);
    await expect(capabilities.getByText("Not allowed", { exact: true })).toHaveCount(3);
  });

  test("marks the screen as development fixture data", async ({ page }) => {
    await page.goto("/profile");

    const notice = page.getByRole("note");

    await expect(notice).toBeVisible();
    await expect(notice).toContainText("Development only");
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

  test("gives the focused verification link a visible focus ring", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto("/profile");

    const action = page.getByRole("link", { name: "Verify your institution" });
    await action.focus();
    await expect(action).toBeFocused();

    const outline = await action.evaluate((el) => {
      const style = getComputedStyle(el);
      return { width: style.outlineWidth, style: style.outlineStyle };
    });

    expect(outline.style).not.toBe("none");
    expect(parseFloat(outline.width)).toBeGreaterThan(0);
  });

  test("reaches the verification link by keyboard alone", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto("/profile");

    const action = page.getByRole("link", { name: "Verify your institution" });

    for (let press = 0; press < 12; press += 1) {
      await page.keyboard.press("Tab");
      if (await action.evaluate((el) => el === document.activeElement)) {
        return;
      }
    }

    throw new Error("Verification link was not reachable within 12 tab presses");
  });
});
