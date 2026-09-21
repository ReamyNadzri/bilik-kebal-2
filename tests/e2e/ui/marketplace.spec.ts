import { expect, test, type Page } from "@playwright/test";

/**
 * The marketplace surfaces: homepage, Board, Wanted detail and Hunt.
 *
 * `/`, `/board` and `/wanted/[id]` now read the published public Wanted
 * operations, which refuse a viewer without a verified email. No session can be
 * seeded for CI, so these runs exercise the real refusal on every one of them —
 * the state a first-time visitor actually meets — plus the shell, the keyboard
 * path and 360 px. The populated, empty, filtered and not-found states are
 * covered against the contract in the page tests, which is where they can be
 * driven without inventing a session.
 *
 * `/claims` is still Phase 4 fixture work, so its own flows run in full here.
 */

const NARROW = { width: 360, height: 760 };
const WIDE = { width: 1440, height: 900 };

async function overflows(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
}

test.describe("homepage", () => {
  test("opens on the marketplace rather than on sign-in", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1, name: "Ask for it. Back it. Claim it." }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Browse the Board" })).toBeVisible();
    await expect(page.getByLabel(/password/i)).toHaveCount(0);
  });

  test("explains the loop and both verification steps even when it cannot list requests", async ({
    page,
  }) => {
    await page.setViewportSize(WIDE);
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "How the hunt works" })).toBeVisible();
    await expect(page.getByText(/Verify your institution to fund a bounty/)).toBeInViewport();
  });

  test("asks a visitor with no session to sign in before listing requests", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Sign in to see open requests" })).toBeVisible();
    // Scoped to the page's own refusal: the shell rail carries its own
    // account sign-in link, and that one remembers where the viewer was.
    await expect(
      page.locator("main").getByRole("link", { name: "Sign in", exact: true }),
    ).toHaveAttribute("href", "/sign-in");
  });

  test("carries no development fixture marker", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("main").getByText("Development only")).toHaveCount(0);
  });

  test("searching from the homepage lands on the Board carrying the search", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("searchbox", { name: "Search Wanted requests" }).fill("calculus");
    await page.getByRole("button", { name: "Search the Board" }).click();

    await expect(page).toHaveURL(/\/board\?.*q=calculus/);
    await expect(page.getByRole("heading", { level: 1, name: "Wanted Board" })).toBeVisible();
  });

  test("Browse the Board reaches the Board", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "Browse the Board" }).click();

    await expect(page).toHaveURL(/\/board$/);
  });

  test("reaches the sign-in action by keyboard alone", async ({ page }) => {
    await page.goto("/");

    const signIn = page.locator("main").getByRole("link", { name: "Sign in", exact: true });
    await signIn.focus();

    await expect(signIn).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("fits 360 px without horizontal overflow", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto("/");

    expect(await overflows(page)).toBe(false);
  });
});

test.describe("Wanted Board", () => {
  test("refuses a visitor with no session and offers sign-in", async ({ page }) => {
    await page.goto("/board");

    await expect(page.getByRole("heading", { level: 1, name: "Wanted Board" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sign in to browse the Board" })).toBeVisible();
    await expect(
      page.locator("main").getByRole("link", { name: "Sign in", exact: true }),
    ).toHaveAttribute("href", "/sign-in");
  });

  test("shows no request list to a viewer it has refused", async ({ page }) => {
    await page.goto("/board");

    await expect(page.getByRole("list", { name: "Wanted requests" })).toHaveCount(0);
  });

  /**
   * The address is the Board's state, so it must survive the round trip even
   * when the read is refused: the reader signs in and returns to the view they
   * asked for, not to an unfiltered Board.
   */
  test("keeps the filters in the address while the read is refused", async ({ page }) => {
    await page.goto("/board?q=calculus&campus=any-campus&sort=ending-soon");

    await expect(page).toHaveURL(/q=calculus/);
    await expect(page).toHaveURL(/campus=any-campus/);
    await expect(page).toHaveURL(/sort=ending-soon/);
  });

  test("the back button returns to the previous view of the Board", async ({ page }) => {
    await page.goto("/board");
    await page.goto("/board?q=calculus");

    await page.goBack();

    await expect(page).toHaveURL(/\/board$/);
  });

  test("carries no development fixture marker", async ({ page }) => {
    await page.goto("/board");

    await expect(page.getByRole("main").getByText("Development only")).toHaveCount(0);
  });

  test("leaks no contributor, ledger or provider detail to a refused viewer", async ({ page }) => {
    await page.goto("/board");

    const shown = (await page.getByRole("main").textContent()) ?? "";

    expect(shown).not.toMatch(/toyyibpay|ledger|contributor|service_role|bucket/i);
  });

  test("fits 360 px without horizontal overflow", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto("/board");

    expect(await overflows(page)).toBe(false);
  });
});

test.describe("Wanted detail", () => {
  /**
   * Authentication is decided before existence, so an anonymous visitor is
   * asked to sign in whatever identifier they typed. That is the safer order:
   * a 404 for one address and a refusal for another would tell a stranger
   * which requests exist.
   */
  test("refuses a visitor with no session rather than revealing whether it exists", async ({
    page,
  }) => {
    await page.goto("/wanted/csc510-final-exam-notes");

    await expect(page.getByRole("heading", { name: "Sign in to read this request" })).toBeVisible();
  });

  test("answers the same way for an address that was never real", async ({ page }) => {
    await page.goto("/wanted/no-such-request-at-all");

    await expect(page.getByRole("heading", { name: "Sign in to read this request" })).toBeVisible();
  });

  test("returns to the Board", async ({ page }) => {
    await page.goto("/wanted/csc510-final-exam-notes");

    await page.getByRole("link", { name: "Back to the Wanted Board" }).click();

    await expect(page).toHaveURL(/\/board$/);
  });

  test("carries no development fixture marker", async ({ page }) => {
    await page.goto("/wanted/csc510-final-exam-notes");

    await expect(page.getByRole("main").getByText("Development only")).toHaveCount(0);
  });

  test("fits 360 px without horizontal overflow", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto("/wanted/csc510-final-exam-notes");

    expect(await overflows(page)).toBe(false);
  });
});

test.describe("shell", () => {
  test("marks the Board as the current destination", async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto("/board");

    await expect(page.getByRole("link", { name: "Wanted Board", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("keeps the Board marked while reading one of its Wanteds", async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto("/wanted/csc510-final-exam-notes");

    await expect(page.getByRole("link", { name: "Wanted Board", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("keeps every destination and the action reachable at 360 px", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto("/");

    for (const label of ["Wanted Board", "Hunt", "Archive", "Notifications", "Profile"]) {
      await expect(page.getByRole("link", { name: label, exact: true })).toBeVisible();
    }

    await expect(page.getByRole("link", { name: "Post a Wanted" }).first()).toBeVisible();
  });

  test("reveals the skip link on first tab and moves focus to main", async ({ page }) => {
    await page.goto("/board");

    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();

    await page.keyboard.press("Enter");

    expect(await page.evaluate(() => document.activeElement?.id)).toBe("main-content");
  });

  test("no longer presents the provisional notice as product content", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByText("Provisional interface. Final visual design pending external handoff."),
    ).toHaveCount(0);
  });
});

test.describe("Hunt", () => {
  test("still says it is fixture-backed, because Claims is Phase 4", async ({ page }) => {
    await page.goto("/claims");

    await expect(page.getByRole("main").getByText("Development only")).toBeVisible();
    await expect(page.getByText(/The Hunt workspace/)).toBeVisible();
  });

  test("offers open hunts and a separate claim ledger", async ({ page }) => {
    await page.goto("/claims");

    await expect(
      page.getByRole("heading", { level: 1, name: "Take a hunt, claim the bounty" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Open hunts" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "My claims" })).toBeVisible();
  });

  test("a hunt leads through to its Wanted", async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto("/claims");

    await page
      .getByRole("list", { name: "Open hunt opportunities" })
      .getByRole("link", { name: /View hunt: Tutorial solutions/ })
      .click();

    await expect(page).toHaveURL(/\/wanted\/csc584-tutorial-solutions$/);
  });

  test("keeps Not selected and Rejected distinct in word and consequence", async ({ page }) => {
    await page.goto("/claims");

    const claims = page.getByRole("list", { name: "My claim history" });

    await expect(claims.getByText(/Claim status:\s*Not selected/)).toBeVisible();
    await expect(claims.getByText(/Claim status:\s*Rejected/)).toBeVisible();
    await expect(claims.getByText(/Your claim was valid/)).toBeVisible();
    await expect(claims.getByText(/did not meet the content policy/)).toBeVisible();
  });

  test("offers no upload or submit control on a fixture", async ({ page }) => {
    await page.goto("/claims");

    await expect(page.getByRole("button", { name: /submit|upload/i })).toHaveCount(0);
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
  });

  test("says the workspace is unavailable rather than showing it as empty", async ({ page }) => {
    await page.goto("/claims?preview=unavailable");

    await expect(page.getByRole("heading", { name: "Hunt could not be loaded" })).toBeVisible();
    await expect(page.getByText(/no open hunts right now/i)).toHaveCount(0);
  });

  test("sends an empty ledger to the Board", async ({ page }) => {
    await page.goto("/claims?preview=empty");

    await page.getByRole("link", { name: "Browse the Wanted Board" }).click();

    await expect(page).toHaveURL(/\/board$/);
  });

  test("marks Hunt as the current destination", async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto("/claims");

    await expect(page.getByRole("link", { name: "Hunt", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("fits 360 px without horizontal overflow", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto("/claims");

    expect(await overflows(page)).toBe(false);
  });
});
