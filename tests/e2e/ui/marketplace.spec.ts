import { expect, test, type Page } from "@playwright/test";

/**
 * The marketplace surfaces: homepage, Board and Wanted detail.
 *
 * These are fixture-backed and need no Supabase, so they run in every
 * environment. What they prove that a component test cannot: the `GET` forms
 * really navigate, the URL really carries the Board's state, and nothing
 * overflows a 360 px viewport.
 */

const NARROW = { width: 360, height: 760 };

/**
 * The applied-filter count is rendered twice — as the rail's caption for wide
 * screens and inside the disclosure summary for narrow ones — and exactly one
 * is displayed at any width. Asserting on the displayed one is the point:
 * it proves the right variant is showing for this viewport.
 */
function filterCount(page: Page, text: string | RegExp) {
  return page.getByText(text).filter({ visible: true });
}

async function overflows(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
}

test.describe("homepage", () => {
  test("opens on the marketplace rather than on sign-in", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1, name: "Find the notes worth hunting for." }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Browse the Board" })).toBeVisible();
    await expect(page.getByLabel(/password/i)).toHaveCount(0);
  });

  test("shows live requests above the fold at desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    const preview = page.getByRole("list", { name: "Open Wanted requests" });

    await expect(preview.getByRole("listitem")).toHaveCount(4);
    await expect(preview.getByRole("listitem").first()).toBeInViewport();
  });

  test("keeps the verification explanation above the fold at desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    await expect(page.getByText(/Verify your institution to fund a bounty/)).toBeInViewport();
  });

  test("searching from the homepage lands on a filtered Board", async ({ page }) => {
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

  test("fits 360 px without horizontal overflow", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto("/");

    expect(await overflows(page)).toBe(false);
  });
});

test.describe("Wanted Board", () => {
  test("carries a filter into the address so the view can be shared", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/board");

    await page.getByLabel("Campus").selectOption("arau");
    await page.getByRole("button", { name: "Apply filters" }).click();

    await expect(page).toHaveURL(/campus=arau/);
    await expect(filterCount(page, "1 filter applied")).toBeVisible();
  });

  test("restores the applied filter from the address", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/board?campus=arau&status=closed");

    await expect(page.getByLabel("Campus")).toHaveValue("arau");
    await expect(page.getByLabel("Status")).toHaveValue("closed");
    await expect(filterCount(page, "2 filters applied")).toBeVisible();
  });

  test("changing the sort keeps the filters rather than dropping them", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/board?campus=shah-alam");

    await page.getByLabel("Sort by").selectOption("highest-bounty");
    await page.getByRole("button", { name: "Apply filters" }).click();

    await expect(page).toHaveURL(/campus=shah-alam/);
    await expect(page).toHaveURL(/sort=highest-bounty/);
  });

  test("clearing the filters keeps the search text", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/board?q=notes&campus=arau");

    await page.getByRole("link", { name: "Clear all filters" }).click();

    await expect(page).toHaveURL(/\/board\?q=notes$/);
  });

  test("the back button returns to the previous view of the Board", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/board");
    await page.goto("/board?campus=arau");

    await page.goBack();

    await expect(page).toHaveURL(/\/board$/);
    await expect(page.getByText("12 Wanted requests")).toBeVisible();
  });

  test("a card leads through to its Wanted", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/board?q=csc510%20final");

    await page.getByRole("link", { name: /View this Wanted: Final exam notes/ }).click();

    await expect(page).toHaveURL(/\/wanted\/csc510-final-exam-notes$/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Final exam notes and summary for chapters 1 to 12",
      }),
    ).toBeVisible();
  });

  test("offers a way out of a search that matched nothing", async ({ page }) => {
    await page.goto("/board?q=zzzz");

    await expect(
      page.getByRole("heading", { name: "No request matches this search" }),
    ).toBeVisible();

    await page.getByRole("link", { name: "Clear the search and filters" }).click();

    await expect(page).toHaveURL(/\/board$/);
  });

  test("filters collapse into a keyboard-operable disclosure at 360 px", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto("/board");

    await expect(filterCount(page, "No filters applied")).toBeVisible();
    await expect(page.getByLabel("Campus")).toBeHidden();

    const summary = page.locator("summary", { hasText: "Filters" });
    await summary.focus();
    await page.keyboard.press("Enter");

    await expect(page.getByLabel("Campus")).toBeVisible();
  });

  test("opens the filters already expanded when some are applied", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto("/board?campus=arau");

    await expect(page.getByLabel("Campus")).toBeVisible();
    await expect(filterCount(page, "1 filter applied")).toBeVisible();
  });

  test("fits 360 px without horizontal overflow", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto("/board");

    expect(await overflows(page)).toBe(false);
  });
});

test.describe("Wanted detail", () => {
  test("shows the bounty, the policy and both actions", async ({ page }) => {
    await page.goto("/wanted/csc510-final-exam-notes");

    await expect(page.getByText("Total bounty RM 85")).toBeVisible();
    await expect(page.getByRole("link", { name: "Back this Wanted" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Submit a Claim" })).toBeVisible();
    await expect(page.getByText(/A Sheriff must approve a claim/)).toBeVisible();
  });

  test("routes a protected action to verification instead of faking it", async ({ page }) => {
    await page.goto("/wanted/csc510-final-exam-notes");

    await page.getByRole("link", { name: "Back this Wanted" }).click();

    await expect(page).toHaveURL(/\/profile\/institution-verification$/);
  });

  test("a similar request leads to its own page", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/wanted/csc510-final-exam-notes");

    await page
      .getByRole("list", { name: "Similar Wanted requests" })
      .getByRole("link", { name: /View this Wanted: Past year questions/ })
      .click();

    await expect(page).toHaveURL(/\/wanted\/csc510-past-year-questions$/);
  });

  test("returns to the Board", async ({ page }) => {
    await page.goto("/wanted/csc510-final-exam-notes");

    await page.getByRole("link", { name: "Back to the Wanted Board" }).click();

    await expect(page).toHaveURL(/\/board$/);
  });

  test("answers an unknown request with a not-found page", async ({ page }) => {
    const response = await page.goto("/wanted/no-such-request");

    expect(response?.status()).toBe(404);
  });

  test("puts the bounty and the actions under the title at 360 px", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto("/wanted/csc510-final-exam-notes");

    const title = await page.getByRole("heading", { level: 1 }).boundingBox();
    const bounty = await page.getByText("Total bounty RM 85").boundingBox();
    const description = await page.getByText(/Looking for complete notes/).boundingBox();

    expect(bounty!.y).toBeGreaterThan(title!.y);
    expect(bounty!.y).toBeLessThan(description!.y);
  });

  test("fits 360 px without horizontal overflow", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto("/wanted/csc510-final-exam-notes");

    expect(await overflows(page)).toBe(false);
  });
});

test.describe("shell", () => {
  test("marks the Board as the current destination", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/board");

    await expect(page.getByRole("link", { name: "Wanted Board", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("keeps the Board marked while reading one of its Wanteds", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
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
  test("offers open hunts and a separate claim ledger", async ({ page }) => {
    await page.goto("/claims");

    await expect(page.getByRole("heading", { level: 1, name: "Hunt" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Open hunts" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "My claims" })).toBeVisible();
  });

  test("a hunt leads through to its Wanted", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
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
    await page.setViewportSize({ width: 1440, height: 900 });
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
