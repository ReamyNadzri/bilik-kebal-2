import type { PayoutTaskView, RefundTaskView } from "@/contracts/payouts";

export interface PayoutRepository {
  listPayoutTasks(status?: string): Promise<PayoutTaskView[]>;
  completePayout(
    payoutTaskId: string,
    externalRef: string,
    method: string,
    notes?: string,
  ): Promise<void>;
  listRefundTasks(status?: string): Promise<RefundTaskView[]>;
  completeRefund(
    refundTaskId: string,
    externalRef: string,
    method: string,
    notes?: string,
  ): Promise<void>;
  expireBounty(wantedRequestId: string): Promise<number>;
  isOwner(userId: string): Promise<boolean>;
  isStaff(userId: string): Promise<boolean>;
}
