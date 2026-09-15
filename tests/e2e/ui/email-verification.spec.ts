import { expect, type Page, test } from "@playwright/test";

const NARROW = { width: 360, height: 760 };

test.describe("email verification", () => {
  test("waits for the link without claiming anything is verified", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto("/verify-email");

    await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();
    await expect(page.getByText("Check your email")).toBeVisible();
    await expect(page.getByText("Email Verified")).toHaveCount(0);
  });

  test("an unknown status falls back to waiting rather than to success", async ({ page }) => {
    await page.goto("/verify-email?status=whatever");

    await expect(page.getByText("Check your email")).toBeVisible();
    await expect(page.getByText("Email Verified")).toHaveCount(0);
  });

  test("success does not imply institution verification", async ({ page }) => {
    await page.goto("/verify-email?status=verified");

    await expect(page.getByText("Email Verified")).toBeVisible();
    await expect(page.getByText("Institution Verified")).toHaveCount(0);
    await expect(page.getByText(/funding a bounty, submitting a claim/i)).toBeVisible();
  });

  /**
   * The resend operation reads the recipient from a signed, HTTP-only cookie
   * that sign-up sets. A browser without it has nothing to resend to, so the
   * screen withholds the button and offers the route that does work. The
   * resend itself is covered by the gated group below, which has a real
   * cookie.
   */
  test("an expired link without a pending sign-up offers the route that works", async ({
    page,
  }) => {
    await page.setViewportSize(NARROW);
    await page.goto("/verify-email?status=expired");

    // Exact: "Expired" would also match "has expired" in the heading.
    await expect(page.getByText("Expired", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Resend the link" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Create an account" })).toBeVisible();
  });

  test("no longer marks the screen as development fixture data", async ({ page }) => {
    await page.goto("/verify-email");

    await expect(page.getByText("Development only")).toHaveCount(0);
  });

  /**
   * The fixture address is gone. An anonymous browser holds no pending
   * verification, so no address may be shown at all.
   */
  test("shows no address when this browser has no pending verification", async ({ page }) => {
    await page.goto("/verify-email");

    await expect(page.getByText("student@example.edu.my")).toHaveCount(0);
    await expect(page.getByText(/A verification link was sent to/)).toHaveCount(0);
  });

  test("an unusable link is announced as a failure", async ({ page }) => {
    await page.goto("/verify-email?status=invalid");

    const alert = page.getByRole("alert").filter({ hasText: "could not be used" });

    await expect(alert).toBeVisible();
  });

  test("fits 360 px without horizontal overflow", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto("/verify-email?status=verified");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );

    expect(overflow).toBe(false);
  });
});

/**
 * The resend needs the signed pending-verification cookie that sign-up sets, so
 * these run against the local stack. One registration for the whole group:
 * Supabase rate-limits outgoing mail per project, and an account per test would
 * compete with tests/e2e/identity/auth-flow.spec.ts for the same budget.
 */
test.describe("email verification, pending sign-up", () => {
  test.describe.configure({ mode: "serial" });

  test.skip(
    process.env.VAULTIX_SUPABASE_E2E !== "1",
    "Set VAULTIX_SUPABASE_E2E=1 with the local Supabase stack running.",
  );

  async function registerPending(page: Page): Promise<string> {
    const email = `vaultix-verify-${crypto.randomUUID()}@not-approved.test`;
    const registration = await page.request.post("/api/auth/sign-up", {
      data: { displayName: "Synthetic Tester", email, password: "VaultixPass123" },
    });
    expect(registration.status()).toBe(202);
    return email;
  }

  test("names the address awaiting confirmation and offers the resend", async ({ page }) => {
    const email = await registerPending(page);

    await page.goto("/verify-email");

    await expect(page.getByText(new RegExp(email))).toBeVisible();
    await expect(page.getByRole("button", { name: "Resend the link" })).toBeVisible();
  });

  /**
   * Asserts the success path only. Supabase enforces a one-second minimum
   * between messages (supabase/config.toml, auth.email.max_frequency), and the
   * time between the registration above and the first click includes a page
   * navigation, so whether an immediate resend is refused is a race rather than
   * a property. The refusal copy is pinned precisely by the component test,
   * which drives that outcome directly.
   */
  test("resends the link and announces it without repeating the visible text", async ({ page }) => {
    await registerPending(page);

    // Comfortably past the one-second minimum, so the resend is not refused.
    await page.waitForTimeout(1_500);

    await page.goto("/verify-email");
    await page.getByRole("button", { name: "Resend the link" }).click();

    await expect(page.getByText(/on its way/i)).toBeVisible();

    const announcer = page.getByTestId("resend-announcer");
    await expect(announcer).toHaveText(/sent/i);
    await expect(announcer).not.toHaveText(/on its way/i);
  });
});
