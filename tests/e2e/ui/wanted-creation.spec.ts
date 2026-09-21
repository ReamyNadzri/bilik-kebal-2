import { expect, test, type Page } from "@playwright/test";

/**
 * The Wanted creation workspace.
 *
 * `/wanted/new` gates the form on the account view model's `transact`
 * capability, then reads the real institution-scoped taxonomy and persists the
 * draft through the published Phase 3A operations. Both need an
 * institution-verified session, which cannot be granted outside the database
 * and is not seeded for CI, so the route itself is exercised for its refusal
 * and the form, validation, review and 360 px behaviours are driven through the
 * development-only preview harness at `/wanted/new/preview`.
 *
 * The harness saves nothing, checks nothing and takes no payment. Nothing here
 * may assert that a draft, duplicate check, contribution or payment was
 * created, because nothing creates one.
 */

const NARROW = { width: 360, height: 760 };
const WIDE = { width: 1440, height: 900 };

async function overflows(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
}

/**
 * Next injects its own route announcer with `role="alert"`, so an unfiltered
 * `getByRole("alert")` matches two elements under strict mode. The page's own
 * alerting regions are the ones inside `main`.
 */
function pageAlerts(page: Page) {
  return page.locator("main [role='alert']");
}

async function fillValidDraft(page: Page): Promise<void> {
  await page.getByLabel("Title", { exact: false }).fill("Final exam notes for the whole syllabus");
  await page
    .getByLabel("What the resource needs to cover")
    .fill("Complete notes covering every chapter, with the key diagrams and worked examples.");
  await page.getByLabel("Campus").selectOption({ label: "UiTM Shah Alam" });
  await page
    .getByLabel("Faculty or college")
    .selectOption({ label: "Faculty of Computer and Mathematical Sciences" });
  await page.getByLabel("Programme").selectOption({ label: "Bachelor of Computer Science" });
  await page.getByLabel("Course").selectOption({ label: "CSC510 Database Systems" });
  await page.getByLabel("Academic session").selectOption({ label: "Semester 2, 2024/2025" });
  await page.getByLabel("Resource type").selectOption({ label: "Lecture notes" });
  await page.getByLabel("Language").selectOption({ label: "English" });
  await page.getByRole("radio", { name: "14 days" }).check();
  await page.getByLabel("Your first contribution").fill("12.50");
  await page.getByRole("checkbox", { name: /content policy/i }).check();
}

test.describe("who may reach the form", () => {
  test("refuses a visitor with no session and offers sign-in", async ({ page }) => {
    await page.goto("/wanted/new");

    await expect(page.getByRole("heading", { level: 1, name: "Post a Wanted" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sign in to post a Wanted" })).toBeVisible();
    // Scoped to the page's own refusal: the shell rail carries its own
    // account sign-in link, and that one remembers where the viewer was.
    await expect(
      page.locator("main").getByRole("link", { name: "Sign in", exact: true }),
    ).toHaveAttribute("href", "/sign-in");
  });

  test("shows no form to a viewer it has refused", async ({ page }) => {
    await page.goto("/wanted/new");

    await expect(page.getByLabel("Title", { exact: false })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Review request/ })).toHaveCount(0);
  });

  test("leaks no draft, duplicate or payment detail to a refused viewer", async ({ page }) => {
    await page.goto("/wanted/new");

    // The reader's view, not the whole document: in development the HTML also
    // carries Next's inlined flight payload and dev scripts, which are not
    // something a refused viewer is being shown.
    const shown = (await page.getByRole("main").textContent()) ?? "";

    expect(shown).not.toMatch(/duplicate|toyyibpay|bill|provider/i);
  });

  test("carries no development fixture marker, because nothing on it is fixture-backed", async ({
    page,
  }) => {
    await page.goto("/wanted/new");

    await expect(page.getByRole("main").getByText("Development only")).toHaveCount(0);
  });

  test("fits 360 px without horizontal overflow when refusing", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto("/wanted/new");

    expect(await overflows(page)).toBe(false);
  });
});

test.describe("the intake form", () => {
  test("asks for every part of the request", async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto("/wanted/new/preview");

    for (const label of [
      "Title",
      "Campus",
      "Faculty or college",
      "Programme",
      "Course",
      "Academic session",
      "Resource type",
      "Language",
      "What the resource needs to cover",
      "Your first contribution",
    ]) {
      await expect(page.getByLabel(label, { exact: false }).first()).toBeVisible();
    }

    await expect(page.getByRole("radio")).toHaveCount(3);
    await expect(page.getByRole("checkbox", { name: /content policy/i })).toBeVisible();
  });

  test("narrows the course list to the chosen faculty and programme", async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto("/wanted/new/preview");

    await expect(page.getByLabel("Course").locator("option")).toHaveCount(1);

    await page
      .getByLabel("Faculty or college")
      .selectOption({ label: "Faculty of Computer and Mathematical Sciences" });
    await page.getByLabel("Programme").selectOption({ label: "Bachelor of Computer Science" });

    await expect(page.getByLabel("Course").locator("option")).toHaveCount(3);
  });

  test("clears a course that no longer belongs when the faculty changes", async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto("/wanted/new/preview");

    await page
      .getByLabel("Faculty or college")
      .selectOption({ label: "Faculty of Computer and Mathematical Sciences" });
    await page.getByLabel("Programme").selectOption({ label: "Bachelor of Computer Science" });
    await page.getByLabel("Course").selectOption({ label: "CSC510 Database Systems" });

    await page.getByLabel("Faculty or college").selectOption({ label: "Faculty of Law" });

    await expect(page.getByLabel("Programme")).toHaveValue("");
    await expect(page.getByLabel("Course")).toHaveValue("");
  });

  test("says the harness options are development fixtures, not an institutional catalogue", async ({
    page,
  }) => {
    await page.goto("/wanted/new/preview");

    await expect(page.getByText(/not a reviewed institutional catalogue/i)).toBeVisible();
    await expect(page.getByRole("main").getByText("Development only")).toBeVisible();
  });
});

test.describe("validation", () => {
  test("summarises the failures and takes focus to the summary", async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto("/wanted/new/preview");

    await page.getByRole("button", { name: /^Review request/ }).click();

    const summary = pageAlerts(page);

    await expect(summary).toContainText("There is a problem");
    await expect(summary).toBeFocused();
  });

  test("renders exactly one alerting region", async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto("/wanted/new/preview");

    await page.getByRole("button", { name: /^Review request/ }).click();

    await expect(pageAlerts(page)).toHaveCount(1);
  });

  test("moves focus into the field a summary link names", async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto("/wanted/new/preview");

    await page.getByRole("button", { name: /^Review request/ }).click();
    await page.getByRole("link", { name: /Enter a title/ }).click();

    await expect(page.getByLabel("Title", { exact: false })).toBeFocused();
  });

  test("keeps what was already entered", async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto("/wanted/new/preview");

    await page.getByLabel("Title", { exact: false }).fill("Past year answers with working");
    await page.getByRole("button", { name: /^Review request/ }).click();

    await expect(page.getByLabel("Title", { exact: false })).toHaveValue(
      "Past year answers with working",
    );
  });

  test("refuses a contribution outside RM1 to RM50", async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto("/wanted/new/preview");

    await fillValidDraft(page);
    await page.getByLabel("Your first contribution").fill("75");
    await page.getByRole("button", { name: /^Review request/ }).click();

    await expect(
      pageAlerts(page).getByRole("link", { name: /between RM1 and RM50/ }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Review your request" })).toHaveCount(0);
  });
});

test.describe("review and return", () => {
  test("reaches review with a valid draft and shows the money from integer sen", async ({
    page,
  }) => {
    await page.setViewportSize(WIDE);
    await page.goto("/wanted/new/preview");

    await fillValidDraft(page);
    await page.getByRole("button", { name: /^Review request/ }).click();

    await expect(page.getByRole("heading", { name: "Review your request" })).toBeVisible();
    await expect(page.getByText("Your first contribution RM 12.50")).toBeVisible();
    await expect(page.getByText("14 days")).toBeVisible();
    await expect(page.getByText(/10% platform fee/)).toBeVisible();
    await expect(page.getByText(/contributors only/i)).toBeVisible();
  });

  test("returns to the form with every value preserved", async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto("/wanted/new/preview");

    await fillValidDraft(page);
    await page.getByRole("button", { name: /^Review request/ }).click();
    await page.getByRole("button", { name: "Back to edit" }).click();

    await expect(page.getByLabel("Title", { exact: false })).toHaveValue(
      "Final exam notes for the whole syllabus",
    );
    await expect(page.getByLabel("Course")).toHaveValue(/.+/);
    await expect(page.getByLabel("Your first contribution")).toHaveValue("12.50");
    await expect(page.getByRole("radio", { name: "14 days" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: /content policy/i })).toBeChecked();
  });

  test("fits 360 px through the whole flow without horizontal overflow", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto("/wanted/new/preview");

    expect(await overflows(page)).toBe(false);

    await fillValidDraft(page);
    await page.getByRole("button", { name: /^Review request/ }).click();

    await expect(page.getByRole("heading", { name: "Review your request" })).toBeVisible();
    expect(await overflows(page)).toBe(false);
  });
});

test.describe("what the harness must never claim", () => {
  test("offers no publish, pay or save-draft control", async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto("/wanted/new/preview");

    await fillValidDraft(page);
    await page.getByRole("button", { name: /^Review request/ }).click();

    await expect(page.getByRole("heading", { name: "Review your request" })).toBeVisible();

    for (const name of [
      /publish/i,
      /^pay/i,
      /continue to payment/i,
      /checkout/i,
      /save draft/i,
      /submit/i,
    ]) {
      await expect(page.getByRole("button", { name })).toHaveCount(0);
    }
  });

  test("states plainly that nothing was created", async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto("/wanted/new/preview");

    await fillValidDraft(page);
    await page.getByRole("button", { name: /^Review request/ }).click();

    await expect(
      page.getByText(/No draft, duplicate check, contribution or payment has been created/i),
    ).toBeVisible();
  });

  test("claims no success anywhere on the flow", async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto("/wanted/new/preview");

    await fillValidDraft(page);
    await page.getByRole("button", { name: /^Review request/ }).click();

    const text = (await page.getByRole("main").textContent()) ?? "";

    expect(text).not.toMatch(/successfully/i);
    expect(text).not.toMatch(/payment (received|complete|confirmed)/i);
    expect(text).not.toMatch(/your request is (live|open|published)/i);
  });

  test("accepts no file upload on this screen", async ({ page }) => {
    await page.goto("/wanted/new/preview");

    await expect(page.locator('input[type="file"]')).toHaveCount(0);
  });
});
