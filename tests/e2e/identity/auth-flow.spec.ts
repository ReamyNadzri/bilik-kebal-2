import { expect, test, type APIRequestContext } from "@playwright/test";

const mailpitUrl = "http://127.0.0.1:55424";

interface MailpitMessageSummary {
  ID: string;
  To: Array<{ Address: string }>;
}

interface MailpitMessages {
  messages: MailpitMessageSummary[];
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
  expect(summary).toBeDefined();

  const messageResponse = await request.get(
    `${mailpitUrl}/api/v1/message/${summary?.ID ?? "missing"}`,
  );
  const message = (await messageResponse.json()) as { HTML: string; Text: string };
  const match = `${message.HTML}\n${message.Text}`.match(/https?:\/\/[^\s"<>]+/);
  expect(match).not.toBeNull();

  return (match?.[0] ?? "").replaceAll("&amp;", "&");
}

test.describe("local Supabase identity flow", () => {
  test.skip(
    process.env.VAULTIX_SUPABASE_E2E !== "1",
    "Set VAULTIX_SUPABASE_E2E=1 with the local Supabase stack running.",
  );

  test("requires email confirmation and creates a private evidence upload URL", async ({
    request,
  }) => {
    const email = `vaultix-e2e-${crypto.randomUUID()}@not-approved.test`;
    const password = "VaultixPass123";

    const registration = await request.post("/api/auth/sign-up", {
      data: { displayName: "Synthetic Tester", email, password },
    });
    expect(registration.status()).toBe(202);
    await expect(registration.json()).resolves.toMatchObject({
      ok: true,
      data: { next: "verify_email" },
    });

    const blockedSignIn = await request.post("/api/auth/sign-in", {
      data: { email, password },
    });
    expect(blockedSignIn.status()).toBe(403);
    await expect(blockedSignIn.json()).resolves.toMatchObject({
      ok: false,
      code: "EMAIL_NOT_VERIFIED",
    });

    const confirmationUrl = await confirmationUrlFor(request, email);
    const confirmation = await request.get(confirmationUrl);
    expect(confirmation.ok()).toBe(true);

    const signIn = await request.post("/api/auth/sign-in", {
      data: { email, password },
    });
    expect(signIn.status()).toBe(200);

    let automaticVerification = await request.post("/api/identity/verify-domain", {
      data: {},
    });
    await expect
      .poll(
        async () => {
          if (automaticVerification.status() === 503) {
            automaticVerification = await request.post("/api/identity/verify-domain", {
              data: {},
            });
          }
          return automaticVerification.status();
        },
        { timeout: 10_000 },
      )
      .toBe(400);
    await expect(automaticVerification.json()).resolves.toMatchObject({
      ok: false,
      code: "DOMAIN_NOT_APPROVED",
    });

    const upload = await request.post("/api/identity/verification-evidence/upload-url", {
      data: {
        fileName: "../../student-card.png",
        mimeType: "image/png",
        userId: "00000000-0000-4000-8000-000000000002",
      },
    });
    expect(upload.status()).toBe(201);
    await expect(upload.json()).resolves.toMatchObject({
      ok: true,
      data: {
        objectPath: expect.stringMatching(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.png$/),
        signedUrl: expect.any(String),
        token: expect.any(String),
      },
    });
  });
});
