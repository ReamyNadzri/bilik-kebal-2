import { z } from "zod";

const providerResponseSchema = z.object({ messageId: z.string().min(1) }).passthrough();
const providerErrorSchema = z.object({ code: z.string().optional() }).passthrough();

export interface NotificationEmailInput {
  notificationId: string;
  recipient: string;
  subject: string;
  text: string;
}

export interface NotificationEmailProvider {
  send(input: NotificationEmailInput): Promise<{ providerMessageId: string }>;
}

export class NotificationEmailDeliveryError extends Error {
  constructor(
    readonly code: "provider_rejected" | "provider_unavailable" | "invalid_recipient",
    readonly retryable: boolean,
  ) {
    super("Notification email delivery failed");
    this.name = "NotificationEmailDeliveryError";
  }
}

export interface BrevoNotificationEmailProviderOptions {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  fetcher?: typeof fetch;
}

/** Sends a server-composed notification through Brevo's transactional email API. */
export class BrevoNotificationEmailProvider implements NotificationEmailProvider {
  private readonly fetcher: typeof fetch;

  constructor(private readonly options: BrevoNotificationEmailProviderOptions) {
    this.fetcher = options.fetcher ?? fetch;
  }

  async send(input: NotificationEmailInput): Promise<{ providerMessageId: string }> {
    try {
      const response = await this.fetcher("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          accept: "application/json",
          "api-key": this.options.apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sender: { email: this.options.fromEmail, name: this.options.fromName },
          to: [{ email: input.recipient }],
          subject: input.subject,
          textContent: input.text,
          // Brevo expects idempotencyKey in the request body headers object (UUID v4).
          headers: { idempotencyKey: input.notificationId },
        }),
      });

      if (!response.ok) {
        let providerErrorCode: string | undefined;
        if (response.status === 400) {
          try {
            const errorData: unknown = await response.json();
            providerErrorCode = providerErrorSchema.safeParse(errorData).data?.code;
          } catch {
            // An unreadable response is handled as a permanent provider rejection.
          }
        }
        const retryable =
          response.status === 408 ||
          response.status === 429 ||
          response.status >= 500 ||
          // A duplicate idempotency key means an earlier attempt may have been accepted.
          providerErrorCode === "duplicate_parameter";
        throw new NotificationEmailDeliveryError(
          retryable ? "provider_unavailable" : "provider_rejected",
          retryable,
        );
      }

      const data: unknown = await response.json();
      const parsed = providerResponseSchema.safeParse(data);
      if (!parsed.success) {
        throw new NotificationEmailDeliveryError("provider_unavailable", true);
      }
      return { providerMessageId: parsed.data.messageId };
    } catch (error) {
      // Provider messages may contain addresses, payload details, or request IDs.
      if (error instanceof NotificationEmailDeliveryError) throw error;
      throw new NotificationEmailDeliveryError("provider_unavailable", true);
    }
  }
}
