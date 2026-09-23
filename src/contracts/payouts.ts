import { z } from "zod";
import type { OperationResult } from "./operation-result";

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
  platformFeeSen: number;
  netPayoutSen: number;
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
  amountSen: number;
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
