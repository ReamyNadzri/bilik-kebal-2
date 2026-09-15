import { z } from "zod";
import type { OperationResult } from "./operation-result";
import type { Sen } from "./marketplace";

export type MoneyOperationCode =
  | "AUTH_REQUIRED"
  | "EMAIL_NOT_VERIFIED"
  | "INSTITUTION_VERIFICATION_REQUIRED"
  | "ACCOUNT_RESTRICTED"
  | "WANTED_NOT_FOUND"
  | "DRAFT_NOT_FOUND"
  | "DRAFT_NOT_EDITABLE"
  | "DUPLICATE_CHECK_REQUIRED"
  | "DUPLICATE_CHECK_EXPIRED"
  | "AMOUNT_OUT_OF_RANGE"
  | "PAYMENT_DISABLED"
  | "PAYMENT_UNAVAILABLE"
  | "PAYMENT_PROVIDER_REJECTED"
  | "PAYMENT_CALLBACK_INVALID"
  | "PAYMENT_CALLBACK_REPLAY"
  | "MONEY_UNAVAILABLE";

export const contributionIntentInputSchema = z.object({
  draftId: z.uuid(),
  duplicateCheckToken: z.string().trim().min(32).max(512),
  amountSen: z.number().int().safe().min(100).max(5000),
});
export type ContributionIntentInput = z.input<typeof contributionIntentInputSchema>;

export type BillStatus = "pending" | "paid" | "failed" | "expired";
export interface BillView {
  id: string;
  provider: "toyyibpay";
  amountSen: Sen;
  status: BillStatus;
  paymentUrl: string;
  expiresAt: string;
}

export interface ProviderBill {
  providerBillId: string;
  paymentUrl: string;
  expiresAt: string;
}

export interface ProviderCallback {
  providerBillId: string;
  providerTransactionId: string;
  merchantCode: string;
  amountSen: number;
  status: "successful" | "failed" | "pending";
  signature: string;
  receivedAt: string;
}

export interface ToyyibPayRawCallback {
  refno: string;
  status: "1" | "2" | "3";
  billcode: string;
  order_id: string;
  amount: string;
  hash: string;
  transaction_time?: string | undefined;
}

export const providerCallbackSchema = z.object({
  refno: z.string().min(1).max(160),
  status: z.enum(["1", "2", "3"]),
  billcode: z.string().min(1).max(160),
  order_id: z.string().min(1).max(160),
  amount: z.string().regex(/^\d+(?:\.\d{1,2})?$/),
  hash: z.string().regex(/^[0-9a-f]+$/i),
  transaction_time: z.string().optional(),
});

export interface VerifiedProviderCallback extends ProviderCallback {
  verified: true;
}

export type CreateContributionIntentResult = OperationResult<BillView, MoneyOperationCode>;
export type HandleProviderCallbackResult = OperationResult<
  { accepted: true; duplicate: boolean },
  MoneyOperationCode
>;
