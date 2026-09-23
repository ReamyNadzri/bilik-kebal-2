import { z } from "zod";
import { notificationKinds } from "@/contracts/notifications";
import type {
  NotificationEmailJob,
  NotificationEmailOutboxRepository,
} from "../services/email-delivery-service";

const claimedJobSchema = z.object({
  notification_id: z.uuid(),
  lease_token: z.uuid(),
  recipient_email: z.email().nullable(),
  notification_kind: z.enum(notificationKinds),
  attempt: z.number().int().positive(),
  idempotency_expires_at: z.iso.datetime({ offset: true }),
  correlation_id: z.uuid(),
});

export interface SupabaseNotificationEmailOutboxRepositoryOptions {
  baseUrl: string;
  serviceRoleKey: string;
  fetcher?: typeof fetch;
}

/** Uses only tightly-scoped service-role RPCs; provider and database errors stay private. */
export class SupabaseNotificationEmailOutboxRepository implements NotificationEmailOutboxRepository {
  private readonly fetcher: typeof fetch;

  constructor(private readonly options: SupabaseNotificationEmailOutboxRepositoryOptions) {
    this.fetcher = options.fetcher ?? fetch;
  }

  async claimBatch(limit = 20): Promise<NotificationEmailJob[]> {
    const rows = await this.rpc(
      "claim_notification_email_batch",
      { batch_size: limit },
      z.array(claimedJobSchema),
    );
    return rows.map((row) => ({
      notificationId: row.notification_id,
      leaseToken: row.lease_token,
      recipient: row.recipient_email,
      kind: row.notification_kind,
      attempt: row.attempt,
      idempotencyExpiresAt: row.idempotency_expires_at,
      correlationId: row.correlation_id,
    }));
  }

  async markSent(
    notificationId: string,
    leaseToken: string,
    providerMessageId: string,
  ): Promise<void> {
    const updated = await this.rpc(
      "mark_notification_email_sent",
      {
        target_notification_id: notificationId,
        target_lease_token: leaseToken,
        target_provider_message_id: providerMessageId,
      },
      z.boolean(),
    );
    if (!updated) throw new Error("Notification email lease is no longer current");
  }

  async recordFailure(
    notificationId: string,
    leaseToken: string,
    code: "provider_rejected" | "provider_unavailable" | "invalid_recipient",
    retryable: boolean,
  ): Promise<void> {
    const state = await this.rpc(
      "record_notification_email_failure",
      {
        target_notification_id: notificationId,
        target_lease_token: leaseToken,
        safe_error_code: code,
        is_retryable: retryable,
      },
      z.enum(["queued", "failed", "manual_review"]).nullable(),
    );
    if (!state) throw new Error("Notification email lease is no longer current");
  }

  async moveToManualReview(
    notificationId: string,
    leaseToken: string,
    reason: "idempotency_window_elapsed",
  ): Promise<void> {
    const updated = await this.rpc(
      "move_notification_email_to_review",
      {
        target_notification_id: notificationId,
        target_lease_token: leaseToken,
        review_reason: reason,
      },
      z.boolean(),
    );
    if (!updated) throw new Error("Notification email lease is no longer current");
  }

  private async rpc<T>(name: string, body: unknown, responseSchema: z.ZodType<T>): Promise<T> {
    let response: Response;
    try {
      response = await this.fetcher(`${this.options.baseUrl}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: {
          apikey: this.options.serviceRoleKey,
          authorization: `Bearer ${this.options.serviceRoleKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw new Error("Notification outbox unavailable");
    }
    if (!response.ok) throw new Error("Notification outbox unavailable");
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new Error("Notification outbox returned an invalid response");
    }
    const parsed = responseSchema.safeParse(data);
    if (!parsed.success) throw new Error("Notification outbox returned an invalid response");
    return parsed.data;
  }
}
