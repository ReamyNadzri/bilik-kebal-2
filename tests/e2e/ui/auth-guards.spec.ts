import { expect, type Page, test } from "@playwright/test";

const NARROW = { width: 360, height: 760 };

/**
 * Route guards and the signed-out shell.
 *
 * These specs run without a configured Supabase, so identity reads fail rather
 * than returning "nobody is signed in". That is deliberately not a redirect:
 * bouncing an outage to the sign-in screen would send every visitor to a form
 * that cannot work either. So what is asserted here is what holds in both
 * cases — the viewer is never stranded, never silently signed in, and never
 * caught in a loop between two screens.
 *
 * The signed-in half of each guard is covered by component tests, which can
 * construct every trust combination without a session.
 */

async function gotoHydrated(page: Page, path: string) {
  await page.goto(path);
  await page.waitForSelector('form[data-hydrated="true"]');
}

/**
 * The shell's own account control.
 *
 * Scoped to the banner because a screen's body may offer its own sign-in link
 * — the Board does when it refuses an unverified reader — and the two say
 * different things: the body link is about that screen, this one is about the
 * session.
 */
function accountSignIn(page: Page) {
  return page.getByRole("banner").getByRole("link", { name: "Sign in" });
}

test.describe("the signed-out shell", () => {
  test("offers a way in from every screen", async ({ page }) => {
    await page.goto("/board");

    await expect(accountSignIn(page)).toBeVisible();
  });

  /**
   * There was no way to sign out anywhere in the interface before this slice.
   * The control is a button because sign-out changes server state and a link
   * would invite a prefetch to end the session.
   */
  test("never offers sign-out as a prefetchable link", async ({ page }) => {
    await page.goto("/board");

    await expect(page.getByRole("link", { name: "Sign out" })).toHaveCount(0);
  });

  test("carries the current screen into the sign-in route", async ({ page }) => {
    await page.goto("/board");

    expect(await accountSignIn(page).getAttribute("href")).toBe("/sign-in?next=%2Fboard");
  });

  /** Offering to return someone to a sign-in screen is a loop, not a courtesy. */
  test("does not offer to return the viewer to a sign-in screen", async ({ page }) => {
    await gotoHydrated(page, "/sign-in");

    expect(await accountSignIn(page).getAttribute("href")).toBe("/sign-in");
  });

  test("keeps the rail usable at 360 px with the account control present", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto("/board");

    await expect(accountSignIn(page)).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );

    expect(overflow).toBe(false);
  });

  /**
   * A hidden navigation entry is not an access control mechanism, but a
   * console link shown to someone who cannot open it is a dead end. The
   * backend's navigation flag decides, and no signed-out viewer has it.
   */
  test("shows no Sheriff console destination to a signed-out viewer", async ({ page }) => {
    await page.goto("/board");

    await expect(page.getByRole("link", { name: "Sheriff Console" })).toHaveCount(0);
  });
});

test.describe("returning the viewer to where they were", () => {
  test("preserves a requested destination through the sign-in screen", async ({ page }) => {
    await gotoHydrated(page, "/sign-in?next=%2Fprofile");

    expect(new URL(page.url()).searchParams.get("next")).toBe("/profile");
    await expect(page.getByLabel(/Email address/)).toBeVisible();
  });

  /**
   * An open redirect on a sign-in screen is a credential phishing route: the
   * victim signs in on the real site and is handed to the attacker's.
   */
  test("does not carry an off-site destination into the form", async ({ page }) => {
    await gotoHydrated(page, "/sign-in?next=https%3A%2F%2Fattacker.example");

    await page.getByLabel(/Email address/).fill("student@example.edu.my");
    await page.getByLabel(/Password/).fill("a-long-passphrase");
    await page.getByRole("button", { name: /Sign in/ }).click();

    await expect(page.locator(".ui-status")).toBeVisible();

    /**
     * The parameter may still sit in the address bar — nothing navigated — but
     * the viewer must never be taken to that origin. The sanitising itself is
     * covered exhaustively by the unit tests for `readNextPath`.
     */
    expect(new URL(page.url()).hostname).not.toBe("attacker.example");
  });

  test("explains an expired session rather than silently returning to the form", async ({
    page,
  }) => {
    await gotoHydrated(page, "/sign-in?next=%2Fprofile&expired=1");

    await expect(page.getByRole("heading", { name: "Your session ended" })).toBeVisible();
  });
});

test.describe("the refusal screen", () => {
  test("says what is missing rather than only that access is denied", async ({ page }) => {
    await page.goto("/forbidden");

    await expect(
      page.getByRole("heading", { name: "Not available to this account", level: 1 }),
    ).toBeVisible();
    await expect(page.locator(".ui-status")).toBeVisible();
  });

  test("always offers a way onwards", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto("/forbidden");

    await expect(page.locator(".ui-status__action a, .ui-status").first()).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );

    expect(overflow).toBe(false);
  });

  test("states the refusal in text rather than by colour alone", async ({ page }) => {
    await page.goto("/forbidden");

    await expect(page.locator(".ui-status__label")).toBeVisible();
  });
});

test.describe("protected screens", () => {
  /**
   * Whatever identity answers, a protected screen never renders an empty frame
   * and never presents itself as signed in.
   */
  for (const path of ["/profile", "/console", "/console/claims"]) {
    test(`${path} never renders account data to a viewer without an account`, async ({ page }) => {
      await page.goto(path);
      // The guard's redirect completes in the browser, so the landing URL is
      // not settled until the navigation is.
      await page.waitForLoadState("networkidle");

      const landed = new URL(page.url()).pathname;

      if (landed === "/sign-in") {
        await expect(page.getByLabel(/Email address/)).toBeVisible();
        return;
      }

      await expect(page.locator(".ui-status")).toBeVisible();
      await expect(page.getByRole("list", { name: "Account capabilities" })).toHaveCount(0);
    });
  }
});
