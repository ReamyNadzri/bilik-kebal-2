import { z } from "zod";
import type { OperationResult } from "./operation-result";
import type { PaymentRecipient } from "./payment-details";

export const PAYOUT_METHODS = ["duitnow", "bank_transfer", "touch_n_go", "other"] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number];

export const REFUND_METHODS = [
  "duitnow",
  "bank_transfer",
  "touch_n_go",
  "toyyibpay_reversal",
  "other",
] as const;
export type RefundMethod = (typeof REFUND_METHODS)[number];

export type PayoutTaskStatus = "pending" | "processing" | "completed" | "failed";
export type RefundTaskStatus = "pending" | "processing" | "completed" | "failed";

export interface PayoutTaskView {
  id: string;
  wantedRequestId: string;
  claimId: string;
  hunterUserId: string;
  hunterDisplayName?: string;
  grossBountySen: number;
  feeRateBasisPoints: number;
  /** Fees paid on top of the contributions; never deducted from the bounty. */
  platformFeeSen: number;
  /** What the Hunter is paid: the whole bounty. */
  netPayoutSen: number;
  /** Funded (partly) through the test gateway: that money was never received. */
  testMoney?: boolean;
  /** Where to send it. Only the Owner receives this, and only while pending. */
  recipient?: PaymentRecipient | null;
  status: PayoutTaskStatus;
  externalReference: string | null;
  payoutMethod: string | null;
  evidenceNotes: string | null;
  completedAt: string | null;
  ownerUserId: string | null;
  createdAt: string;
}

export interface RefundTaskView {
  id: string;
  wantedRequestId: string;
  contributionId: string;
  contributorUserId: string;
  contributorDisplayName?: string;
  /** The contribution. The refund is amountSen + feeSen. */
  amountSen: number;
  /** The fee paid on top of it, refunded too. */
  feeSen?: number;
  /** Paid through the test gateway: nothing was received, nothing to send. */
  testMoney?: boolean;
  /** Where to send it. Only the Owner receives this, and only while pending. */
  recipient?: PaymentRecipient | null;
  status: RefundTaskStatus;
  externalReference: string | null;
  refundMethod: string | null;
  evidenceNotes: string | null;
  completedAt: string | null;
  ownerUserId: string | null;
  createdAt: string;
}

export const recordPayoutCompletionSchema = z.object({
  externalReference: z
    .string()
    .trim()
    .min(3, "External reference must be at least 3 characters.")
    .max(120),
  payoutMethod: z.enum(PAYOUT_METHODS),
  evidenceNotes: z.string().trim().max(2000).optional(),
});

export type RecordPayoutCompletionInput = z.infer<typeof recordPayoutCompletionSchema>;

export const recordRefundCompletionSchema = z.object({
  externalReference: z
    .string()
    .trim()
    .min(3, "External reference must be at least 3 characters.")
    .max(120),
  refundMethod: z.enum(REFUND_METHODS),
  evidenceNotes: z.string().trim().max(2000).optional(),
});

export type RecordRefundCompletionInput = z.infer<typeof recordRefundCompletionSchema>;

export const expireBountyInputSchema = z.object({
  wantedRequestId: z.string().uuid(),
});

export type ExpireBountyInput = z.infer<typeof expireBountyInputSchema>;

export type PayoutOperationCode =
  | "SUCCESS"
  | "NOT_FOUND"
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "INVALID_STATE"
  | "VALIDATION_ERROR"
  | "LEDGER_ERROR";

export type RefundOperationCode =
  | "SUCCESS"
  | "NOT_FOUND"
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "INVALID_STATE"
  | "VALIDATION_ERROR"
  | "LEDGER_ERROR";

export type RecordPayoutResult = OperationResult<{ payoutTaskId: string }, PayoutOperationCode>;
export type RecordRefundResult = OperationResult<{ refundTaskId: string }, RefundOperationCode>;
export type ExpireBountyResult = OperationResult<{ refundsCreated: number }, RefundOperationCode>;
