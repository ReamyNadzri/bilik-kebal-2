import { describe, expect, test, vi } from "vitest";
import { BrevoNotificationEmailProvider } from "./brevo-email-provider";

describe("BrevoNotificationEmailProvider", () => {
  const input = {
    notificationId: "1a123456-7890-4abc-8def-123456789abc",
    recipient: "hunter@example.test",
    subject: "Your claim was approved",
    text: "Your claim was approved.",
    html: "<!DOCTYPE html><p>Your claim was approved.</p>",
  };

  test("sends a transactional email with stable body idempotency and private credentials", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ messageId: "<mail-123@example.test>" }), {
        headers: { "content-type": "application/json" },
        status: 201,
      }),
    );
    const provider = new BrevoNotificationEmailProvider({
      apiKey: "test-secret",
      fromEmail: "notifications@bilikkebal.afes.my",
      fromName: "VAULTIX",
      fetcher,
    });

    await expect(provider.send(input)).resolves.toEqual({
      providerMessageId: "<mail-123@example.test>",
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.brevo.com/v3/smtp/email",
      expect.objectContaining({
        method: "POST",
        headers: {
          accept: "application/json",
          "api-key": "test-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sender: { email: "notifications@bilikkebal.afes.my", name: "VAULTIX" },
          to: [{ email: input.recipient }],
          subject: input.subject,
          htmlContent: input.html,
          textContent: input.text,
          headers: { idempotencyKey: input.notificationId },
        }),
      }),
    );
  });

  test("classifies temporary HTTP failures as retryable and permanent failures as terminal", async () => {
    for (const scenario of [
      { status: 429, retryable: true },
      { status: 503, retryable: true },
      { status: 422, retryable: false },
    ]) {
      const provider = new BrevoNotificationEmailProvider({
        apiKey: "test-secret",
        fromEmail: "notifications@bilikkebal.afes.my",
        fromName: "VAULTIX",
        fetcher: vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ message: "private provider detail" }), {
            status: scenario.status,
          }),
        ),
      });

      await expect(provider.send(input)).rejects.toMatchObject({
        retryable: scenario.retryable,
      });
    }
  });

  test("treats a repeated provider idempotency key as an uncertain delivery", async () => {
    const provider = new BrevoNotificationEmailProvider({
      apiKey: "test-secret",
      fromEmail: "notifications@bilikkebal.afes.my",
      fromName: "VAULTIX",
      fetcher: vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ code: "duplicate_parameter" }), { status: 400 }),
        ),
    });

    await expect(provider.send(input)).rejects.toMatchObject({
      code: "provider_unavailable",
      retryable: true,
    });
  });
});
