import { expect, test } from "@playwright/test";

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

  test("an expired link offers a replacement", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto("/verify-email?status=expired");

    // Exact: "Expired" would also match "has expired" in the heading.
    await expect(page.getByText("Expired", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Resend the link" })).toBeVisible();
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

test.describe("Sheriff Console", () => {
  test("refuses a viewer without the role and says the server enforces it", async ({ page }) => {
    await page.goto("/console");

    const refusal = page.getByRole("alert").filter({ hasText: "Restricted" });

    await expect(refusal).toBeVisible();
    await expect(page.getByText(/checked on the server/i)).toBeVisible();
    await expect(page.getByRole("list", { name: "Review queues" })).toHaveCount(0);
  });

  test("does not advertise the console to a viewer whose role lacks it", async ({ page }) => {
    await page.goto("/profile");

    await expect(page.getByRole("link", { name: "Sheriff Console" })).toHaveCount(0);
  });
});
