import { expect, test, type Page } from "@playwright/test";

/**
 * The Hunters wall on the Board, the homepage strip, and the way between them.
 *
 * As in marketplace.spec.ts, no session can be seeded for CI, so these runs
 * meet the real refusal a signed-out visitor gets, plus the toggle, the
 * keyboard path and 360 px. The populated wall, paging, motion and the
 * profile poster are covered against the contract in the component and page
 * tests.
 */

const NARROW = { width: 360, height: 760 };

async function overflows(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
}

test.describe("Hunters on the Board", () => {
  test("asks a signed-out visitor to sign in, and returns them to the same page", async ({
    page,
  }) => {
    await page.goto("/board?view=hunters&per=15&page=2");

    await expect(page.getByText("Sign in to see the Hunters")).toBeVisible();
    await expect(page.getByRole("button", { name: "Hunters" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByRole("link", { name: "Sign in", exact: true }).last()).toHaveAttribute(
      "href",
      `/sign-in?next=${encodeURIComponent("/board?view=hunters&per=15&page=2")}`,
    );
  });

  test("switches between the two Board views from the keyboard", async ({ page }) => {
    await page.goto("/board");

    const hunters = page.getByRole("button", { name: "Hunters" });
    await expect(page.getByRole("button", { name: "Wanted requests" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await hunters.focus();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/board\?view=hunters$/);
    await expect(page.getByRole("button", { name: "Hunters" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.goBack();
    await expect(page).toHaveURL(/\/board$/);
  });

  test("gives each toggle button a 44 px target", async ({ page }) => {
    await page.goto("/board?view=hunters");

    for (const name of ["Wanted requests", "Hunters"]) {
      const box = await page.getByRole("button", { name }).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });

  test("fits 360 px without horizontal overflow", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto("/board?view=hunters");

    await expect(page.getByText("Sign in to see the Hunters")).toBeVisible();
    expect(await overflows(page)).toBe(false);
  });
});

test.describe("the homepage strip", () => {
  test("follows Featured Wanted and explains the refusal in the same words", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 2, name: "Hunters on the Board" }),
    ).toBeVisible();
    await expect(page.getByText("Sign in to see the Hunters")).toBeVisible();
  });

  test("fits 360 px without horizontal overflow", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 2, name: "Hunters on the Board" }),
    ).toBeVisible();
    expect(await overflows(page)).toBe(false);
  });
});
