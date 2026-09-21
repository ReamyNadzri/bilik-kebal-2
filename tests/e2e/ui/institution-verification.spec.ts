import {
  expect,
  request as apiRequest,
  type APIRequestContext,
  type Page,
  test,
} from "@playwright/test";

const NARROW = { width: 360, height: 760 };

/**
 * The screen is server-loaded now, so an anonymous visitor never sees the
 * request form: they are asked to sign in, to confirm their address, or told
 * that verification is unavailable when Supabase is not configured for the run.
 * These assertions hold in all three, which keeps the gate meaningful whether
 * or not the local stack is up. The form's own behaviour is covered by the
 * component tests, which can drive every operation outcome.
 */
const REFUSAL_HEADING =
  /^(Sign in to verify your institution|Confirm your email address first|Verification is unavailable)$/;

test.describe("institution verification", () => {
  test("fits 360 px without horizontal overflow", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto("/profile/institution-verification");

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );

    expect(overflow).toBe(false);
  });

  test("explains why the request form is not shown", async ({ page }) => {
    await page.goto("/profile/institution-verification");
    // The guard's redirect completes in the browser, so the landing URL is not
    // settled until the navigation is.
    await page.waitForLoadState("networkidle");

    /**
     * Verification is tied to an account, so a signed-out visitor is sent to
     * sign in and returned here afterwards. Without a reachable identity
     * service the guard deliberately does not redirect, and the screen says so
     * in place instead.
     */
    if (new URL(page.url()).pathname === "/sign-in") {
      expect(new URL(page.url()).searchParams.get("next")).toBe(
        "/profile/institution-verification",
      );
      await expect(page.getByLabel(/Email address/)).toBeVisible();
      return;
    }

    await expect(
      page.getByRole("heading", { name: "Institution verification", level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: REFUSAL_HEADING })).toBeVisible();
  });

  test("no longer marks the screen as development fixture data", async ({ page }) => {
    await page.goto("/profile/institution-verification");

    await expect(page.getByText("Development only")).toHaveCount(0);
  });

  test("offers no request form to an anonymous visitor", async ({ page }) => {
    await page.goto("/profile/institution-verification");

    await expect(page.getByRole("button", { name: "Request verification" })).toHaveCount(0);
    await expect(page.getByLabel(/Evidence of affiliation/)).toHaveCount(0);
  });

  test("reveals the skip link on first tab and moves focus to main", async ({ page }) => {
    await page.setViewportSize(NARROW);
    await page.goto("/profile/institution-verification");

    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();

    await page.keyboard.press("Enter");

    expect(await page.evaluate(() => document.activeElement?.id)).toBe("main-content");
  });
});

/**
 * The link from `/profile` only exists for a signed-in account that is email
 * verified and not yet institution verified, so proving it is reachable needs a
 * real session. Navigating straight to the URL would assert nothing about the
 * journey.
 */
const mailpitUrl = "http://127.0.0.1:55424";

interface MailpitMessages {
  messages: Array<{ ID: string; To: Array<{ Address: string }> }>;
}

async function confirmationUrlFor(request: APIRequestContext, email: string): Promise<string> {
  await expect
    .poll(
      async () => {
        const response = await request.get(`${mailpitUrl}/api/v1/messages`);
        const inbox = (await response.json()) as MailpitMessages;
        return inbox.messages.some((message) =>
          message.To.some((recipient) => recipient.Address === email),
        );
      },
      { timeout: 10_000 },
    )
    .toBe(true);

  const inboxResponse = await request.get(`${mailpitUrl}/api/v1/messages`);
  const inbox = (await inboxResponse.json()) as MailpitMessages;
  const summary = inbox.messages.find((message) =>
    message.To.some((recipient) => recipient.Address === email),
  );

  const messageResponse = await request.get(
    `${mailpitUrl}/api/v1/message/${summary?.ID ?? "missing"}`,
  );
  const message = (await messageResponse.json()) as { HTML: string; Text: string };
  const match = `${message.HTML}\n${message.Text}`.match(/https?:\/\/[^\s"<>]+/);

  return (match?.[0] ?? "").replaceAll("&amp;", "&");
}

/**
 * One account for the whole gated group, created once.
 *
 * Sign-up sends a confirmation email, and Supabase rate-limits outgoing mail
 * per project, so an account per test would consume the same budget that the
 * identity flow spec depends on and make it fail intermittently. Signing in
 * again costs no email, so the account is created once and reused.
 */
let sharedAccount: { email: string; password: string } | null = null;

async function createConfirmedAccount(): Promise<{ email: string; password: string }> {
  const context = await apiRequest.newContext({
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
  });
  const email = `vaultix-ui-${crypto.randomUUID()}@not-approved.test`;
  const password = "VaultixPass123";

  const registration = await context.post("/api/auth/sign-up", {
    data: { displayName: "Synthetic Tester", email, password },
  });
  expect(registration.status()).toBe(202);

  const confirmationUrl = await confirmationUrlFor(context, email);
  await context.get(confirmationUrl);
  await context.dispose();

  return { email, password };
}

/**
 * Signs in through `page.request`, which shares the browser context's cookie
 * jar, so the session is present for subsequent `page.goto` calls.
 */
async function signInVerifiedStudent(page: Page): Promise<void> {
  const account = sharedAccount;
  expect(account).not.toBeNull();

  const signIn = await page.request.post("/api/auth/sign-in", {
    data: { email: account?.email, password: account?.password },
  });
  expect(signIn.status()).toBe(200);
}

test.describe("institution verification, signed in", () => {
  // Serial so the shared account is created exactly once for the group.
  test.describe.configure({ mode: "serial" });

  test.skip(
    process.env.VAULTIX_SUPABASE_E2E !== "1",
    "Set VAULTIX_SUPABASE_E2E=1 with the local Supabase stack running.",
  );

  test.beforeAll(async () => {
    sharedAccount = await createConfirmedAccount();
  });

  test("is reached by clicking the action on the profile screen", async ({ page }) => {
    await signInVerifiedStudent(page);

    await page.goto("/profile");

    const action = page.getByRole("link", { name: "Verify your institution" });
    await expect(action).toBeVisible();

    await action.click();

    await expect(page).toHaveURL(/\/profile\/institution-verification$/);
    await expect(
      page.getByRole("heading", { name: "Institution verification", level: 1 }),
    ).toBeVisible();
  });

  test("offers the real verification paths to a confirmed account", async ({ page }) => {
    await signInVerifiedStudent(page);

    await page.goto("/profile/institution-verification");

    await expect(page.getByRole("button", { name: "Check my email domain" })).toBeVisible();

    const privacy = page.getByRole("note", { name: "How your evidence is handled" });
    await expect(privacy).toContainText("30 days");
    await expect(privacy).toContainText("Sheriff");
  });

  test("routes an unapproved domain to evidence review rather than reporting a fault", async ({
    page,
  }) => {
    await signInVerifiedStudent(page);

    await page.goto("/profile/institution-verification");
    await page.getByRole("button", { name: "Check my email domain" }).click();

    const outcome = page.getByTestId("domain-outcome");

    await expect(outcome).toBeVisible();
    await expect(outcome).toContainText(/sheriff/i);
    // The routing message is not an interrupting announcement: nothing failed.
    await expect(page.locator("main [role='alert']")).toHaveCount(0);
  });
});
