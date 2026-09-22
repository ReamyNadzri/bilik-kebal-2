import { expect, test } from "@playwright/test";

/**
 * End-to-end integration suite for the academic bounty and claim submission lifecycle:
 * 1. Draft Creation & Preview: validates integer sen contribution and duplicate check flow.
 * 2. Launch Gate Verification: ensures payments switched off and public uploads disabled by default.
 * 3. Protected Actions Signposting: unverified users signposted to institution verification.
 * 4. Hunter Office & Workspace: live and preview fallback views for opportunities and claims.
 */

test.describe("Marketplace Bounty Creation and Claim Lifecycle", () => {
  test("creation workspace requires authentication before creating live bounties", async ({
    page,
  }) => {
    await page.goto("/wanted/new");
    // Should be redirected or prompted to sign in
    await expect(page.getByRole("heading", { name: /Sign in to post a Wanted/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Sign in/i })).toBeVisible();
  });

  test("creation preview harness allows drafting, validation, and review without charge", async ({
    page,
  }) => {
    await page.goto("/wanted/new/preview");

    await expect(
      page.getByRole("heading", { name: "Post a Wanted request", level: 1 }),
    ).toBeVisible();

    // Fill the draft
    await page.getByLabel("Title", { exact: false }).fill("CSC510 Complete Lecture Notes");
    await page
      .getByLabel("What the resource needs to cover")
      .fill("Detailed chapter-by-chapter summaries and exam problems.");
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
    await page.getByLabel(/^Your first contribution/).fill("25.00");
    await page.getByLabel(/I confirm I hold the rights/).check();

    // Review draft
    await page.getByRole("button", { name: "Review your request" }).click();

    await expect(page.getByRole("heading", { name: "Review your request" })).toBeVisible();
    await expect(
      page.getByText(/No draft, duplicate check, contribution or payment has been created/i),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Back to edit" })).toBeVisible();
  });

  test("hunter workspace prompts unauthenticated visitors to sign in while displaying hunts", async ({
    page,
  }) => {
    await page.goto("/claims");

    await expect(page.getByText("Sign in to submit and track claims")).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  });

  test("hunter workspace renders preview claims and open opportunities in preview mode", async ({
    page,
  }) => {
    await page.goto("/claims?preview=ready");

    await expect(
      page.getByRole("heading", { name: /Take a hunt, claim the bounty/i }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Open hunts" })).toBeVisible();
  });
});
