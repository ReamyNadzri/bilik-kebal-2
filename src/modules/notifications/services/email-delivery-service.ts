import type { NotificationKind } from "@/contracts/notifications";
import { beginOperation } from "@/lib/observability/operation-log";
import {
  NotificationEmailDeliveryError,
  type NotificationEmailProvider,
} from "../adapters/brevo-email-provider";
import {
  renderNotificationEmail,
  type NotificationEmailContext,
} from "../email/render-notification-email";

export interface NotificationEmailJob {
  notificationId: string;
  leaseToken: string;
  recipient: string | null;
  kind: NotificationKind;
  attempt: number;
  idempotencyExpiresAt: string;
  correlationId: string;
  context: NotificationEmailContext;
}

export interface NotificationEmailOutboxRepository {
  claimBatch(limit?: number): Promise<NotificationEmailJob[]>;
  markSent(notificationId: string, leaseToken: string, providerMessageId: string): Promise<void>;
  recordFailure(
    notificationId: string,
    leaseToken: string,
    code: "provider_rejected" | "provider_unavailable" | "invalid_recipient",
    retryable: boolean,
  ): Promise<void>;
  moveToManualReview(
    notificationId: string,
    leaseToken: string,
    reason: "idempotency_window_elapsed",
  ): Promise<void>;
}

export interface NotificationEmailDeliveryDependencies {
  repository: NotificationEmailOutboxRepository;
  provider: NotificationEmailProvider;
  /** Public origin for links and the logo in emails. */
  appUrl: string;
  now?: () => Date;
}

export interface NotificationEmailDeliveryCount {
  claimed: number;
  sent: number;
  retried: number;
  manualReview: number;
  failed: number;
}

/** Drains a leased batch. Retries and state transitions are persisted by the repository. */
export class NotificationEmailDeliveryService {
  private readonly now: () => Date;

  constructor(private readonly dependencies: NotificationEmailDeliveryDependencies) {
    this.now = dependencies.now ?? (() => new Date());
  }

  async dispatchBatch(): Promise<NotificationEmailDeliveryCount> {
    let jobs: NotificationEmailJob[];
    try {
      jobs = await this.dependencies.repository.claimBatch();
    } catch {
      return { claimed: 0, sent: 0, retried: 0, manualReview: 0, failed: 0 };
    }

    const result: NotificationEmailDeliveryCount = {
      claimed: jobs.length,
      sent: 0,
      retried: 0,
      manualReview: 0,
      failed: 0,
    };

    for (const job of jobs) {
      const trace = beginOperation("notifications.email_dispatch", console.info, job.correlationId);
      if (this.now().getTime() >= Date.parse(job.idempotencyExpiresAt)) {
        try {
          await this.dependencies.repository.moveToManualReview(
            job.notificationId,
            job.leaseToken,
            "idempotency_window_elapsed",
          );
          result.manualReview += 1;
          trace.finish(409);
        } catch {
          trace.finish(503);
        }
        continue;
      }

      let providerMessageId: string;
      try {
        if (!job.recipient) {
          throw new NotificationEmailDeliveryError("invalid_recipient", false);
        }
        const email = renderNotificationEmail(job.kind, job.context, this.dependencies.appUrl);
        const delivered = await this.dependencies.provider.send({
          notificationId: job.notificationId,
          recipient: job.recipient,
          subject: email.subject,
          text: email.text,
          html: email.html,
        });
        providerMessageId = delivered.providerMessageId;
      } catch (error) {
        const deliveryError =
          error instanceof NotificationEmailDeliveryError
            ? error
            : new NotificationEmailDeliveryError("provider_unavailable", true);
        try {
          await this.dependencies.repository.recordFailure(
            job.notificationId,
            job.leaseToken,
            deliveryError.code,
            deliveryError.retryable,
          );
          if (deliveryError.retryable) result.retried += 1;
          else result.failed += 1;
          trace.finish(deliveryError.retryable ? 503 : 422);
        } catch {
          trace.finish(503);
        }
        continue;
      }

      try {
        await this.dependencies.repository.markSent(
          job.notificationId,
          job.leaseToken,
          providerMessageId,
        );
        result.sent += 1;
        trace.finish(200);
      } catch {
        // Leave the lease to expire; a replay uses the same provider idempotency key.
        trace.finish(503);
      }
    }

    return result;
  }
}
