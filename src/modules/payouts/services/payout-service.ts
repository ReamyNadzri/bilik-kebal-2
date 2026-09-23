import type {
  ExpireBountyResult,
  PayoutTaskView,
  RecordPayoutCompletionInput,
  RecordPayoutResult,
  RecordRefundCompletionInput,
  RecordRefundResult,
  RefundTaskView,
} from "@/contracts/payouts";
import { failure, success, type OperationResult } from "@/contracts/operation-result";
import type { PayoutRepository } from "../repositories/payout-repository";

export class PayoutService {
  constructor(private readonly repository: PayoutRepository) {}

  async listPayoutTasks(
    actorUserId: string,
    status?: string,
  ): Promise<OperationResult<PayoutTaskView[], "AUTH_REQUIRED" | "FORBIDDEN">> {
    if (!actorUserId) {
      return failure("AUTH_REQUIRED", "Authentication required.");
    }

    const isStaff = await this.repository.isStaff(actorUserId);
    if (!isStaff) {
      return failure("FORBIDDEN", "Only platform staff may view payout tasks.");
    }

    const tasks = await this.repository.listPayoutTasks(status);
    return success(tasks);
  }

  async completePayout(
    actorUserId: string,
    payoutTaskId: string,
    input: RecordPayoutCompletionInput,
  ): Promise<RecordPayoutResult> {
    if (!actorUserId) {
      return failure("AUTH_REQUIRED", "Authentication required.");
    }

    const isOwner = await this.repository.isOwner(actorUserId);
    if (!isOwner) {
      return failure("FORBIDDEN", "Only the platform Owner may record payout completion.");
    }

    try {
      await this.repository.completePayout(
        payoutTaskId,
        input.externalReference,
        input.payoutMethod,
        input.evidenceNotes,
      );

      return success({ payoutTaskId });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to complete payout task.";
      if (message.includes("not found")) {
        return failure("NOT_FOUND", "Pending payout task not found.");
      }
      return failure("LEDGER_ERROR", message);
    }
  }

  async listRefundTasks(
    actorUserId: string,
    status?: string,
  ): Promise<OperationResult<RefundTaskView[], "AUTH_REQUIRED" | "FORBIDDEN">> {
    if (!actorUserId) {
      return failure("AUTH_REQUIRED", "Authentication required.");
    }

    const isStaff = await this.repository.isStaff(actorUserId);
    if (!isStaff) {
      return failure("FORBIDDEN", "Only platform staff may view refund tasks.");
    }

    const tasks = await this.repository.listRefundTasks(status);
    return success(tasks);
  }

  async completeRefund(
    actorUserId: string,
    refundTaskId: string,
    input: RecordRefundCompletionInput,
  ): Promise<RecordRefundResult> {
    if (!actorUserId) {
      return failure("AUTH_REQUIRED", "Authentication required.");
    }

    const isOwner = await this.repository.isOwner(actorUserId);
    if (!isOwner) {
      return failure("FORBIDDEN", "Only the platform Owner may record refund completion.");
    }

    try {
      await this.repository.completeRefund(
        refundTaskId,
        input.externalReference,
        input.refundMethod,
        input.evidenceNotes,
      );

      return success({ refundTaskId });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to complete refund task.";
      if (message.includes("not found")) {
        return failure("NOT_FOUND", "Pending refund task not found.");
      }
      return failure("LEDGER_ERROR", message);
    }
  }

  async expireBounty(actorUserId: string, wantedRequestId: string): Promise<ExpireBountyResult> {
    if (!actorUserId) {
      return failure("AUTH_REQUIRED", "Authentication required.");
    }

    const isStaff = await this.repository.isStaff(actorUserId);
    if (!isStaff) {
      return failure("FORBIDDEN", "Only platform staff may initiate bounty expiry.");
    }

    try {
      const refundsCreated = await this.repository.expireBounty(wantedRequestId);
      return success({ refundsCreated });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to expire bounty.";
      if (message.includes("paused")) {
        return failure("INVALID_STATE", "Bounty is paused by an active appeal.");
      }
      if (message.includes("duration")) {
        return failure("INVALID_STATE", "Bounty duration has not yet elapsed.");
      }
      return failure("INVALID_STATE", message);
    }
  }
}
