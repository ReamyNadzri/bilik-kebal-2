import { createClaimReviewService } from "@/modules/claims/services/create-claim-review-service";
import { createClaimModerationService } from "@/modules/moderation/services/create-claim-moderation-service";
import { createPayoutService } from "@/modules/payouts/services/create-payout-service";

/**
 * How many items wait in each Sheriff queue, for the console overview.
 *
 * `null` means the count is not available to this viewer — no session, a
 * refused role, or a read that failed — and the tile says so rather than
 * showing a zero it cannot vouch for.
 */
export interface ConsoleQueueCounts {
  readonly claims: number | null;
  readonly appeals: number | null;
  readonly payouts: number | null;
  readonly refunds: number | null;
}

/** A count that fails on its own, so one unreadable queue never blanks the rest. */
async function countOrNull(read: () => Promise<number | null>): Promise<number | null> {
  try {
    return await read();
  } catch {
    // The reason belongs in server logs, never in a page a browser reads.
    return null;
  }
}

/**
 * Counts every queue in one server render.
 *
 * Each count comes from the same operation its queue uses, so a tile never
 * counts work the reviewer cannot see, and RLS scopes every read. They run
 * together and share the request's one Auth check — where the overview used to
 * send four separate browser requests after the page arrived, each checking
 * the session again.
 */
export async function loadConsoleQueueCounts(): Promise<ConsoleQueueCounts> {
  const [claims, appeals, payouts, refunds] = await Promise.all([
    countOrNull(async () => {
      const service = await createClaimReviewService();
      if (!service) return null;
      const queue = await service.listQueue();
      return queue.ok ? queue.data.length : null;
    }),
    countOrNull(async () => {
      const service = await createClaimModerationService();
      if (!service) return null;
      return (await service.listAppeals({ status: "pending" })).length;
    }),
    countOrNull(async () => {
      const session = await createPayoutService();
      if (!session) return null;
      const tasks = await session.service.listPayoutTasks(session.userId, "pending");
      return tasks.ok ? tasks.data.length : null;
    }),
    countOrNull(async () => {
      const session = await createPayoutService();
      if (!session) return null;
      const tasks = await session.service.listRefundTasks(session.userId, "pending");
      return tasks.ok ? tasks.data.length : null;
    }),
  ]);

  return { appeals, claims, payouts, refunds };
}
