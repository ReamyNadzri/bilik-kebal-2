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
  | "PAYMENT_DETAILS_REQUIRED"
  | "PAYMENT_BILL_NOT_FOUND"
  | "PAYMENT_BILL_CLOSED"
  | "MONEY_UNAVAILABLE";

/** The platform fee rate snapshotted onto every paid Wanted at publication. */
export const PLATFORM_FEE_BASIS_POINTS = 1000;

/**
 * The fee billed on top of one contribution: the Wanted's snapshotted rate,
 * rounded down to the sen. The database recomputes it and refuses a bill
 * whose fee differs (`private.contribution_fee_sen`).
 */
export function contributionFeeSen(amountSen: number, feeRateBasisPoints: number): number {
  return Math.floor((amountSen * feeRateBasisPoints) / 10_000);
}

/** What a payer is charged: the contribution goes to the bounty, the fee does not. */
export interface ChargeBreakdown {
  amountSen: Sen;
  feeSen: Sen;
  totalSen: Sen;
}

export function chargeBreakdown(amountSen: number, feeRateBasisPoints: number): ChargeBreakdown {
  const feeSen = contributionFeeSen(amountSen, feeRateBasisPoints);
  return {
    amountSen: amountSen as Sen,
    feeSen: feeSen as Sen,
    totalSen: (amountSen + feeSen) as Sen,
  };
}

/**
 * `mock` is the test gateway inside VAULTIX: a real bill, a signed provider
 * event and the same exactly-once ledger path, but no money moves.
 */
export type PaymentProviderName = "toyyibpay" | "mock";

export const contributionIntentInputSchema = z.object({
  draftId: z.uuid(),
  duplicateCheckToken: z.string().trim().min(32).max(512),
  amountSen: z.number().int().safe().min(100).max(5000),
});
export type ContributionIntentInput = z.input<typeof contributionIntentInputSchema>;

/** Backing an open Wanted, addressed by its public id. */
export const backingIntentInputSchema = z.object({
  wantedId: z.uuid(),
  amountSen: z.number().int().safe().min(100).max(5000),
});
export type BackingIntentInput = z.input<typeof backingIntentInputSchema>;

export type BillStatus = "pending" | "paid" | "failed" | "expired";
export interface BillView {
  id: string;
  provider: PaymentProviderName;
  /** The contribution: what the bounty rises by. */
  amountSen: Sen;
  /** The platform fee billed on top. */
  feeSen: Sen;
  /** What the payer is charged: amountSen + feeSen. */
  totalSen: Sen;
  status: BillStatus;
  paymentUrl: string;
  expiresAt: string;
}

export interface ProviderBill {
  providerBillId: string;
  paymentUrl: string;
  expiresAt: string;
}

/** One bill as its payer sees it on the checkout and the return page. */
export interface PayerBill {
  provider: PaymentProviderName;
  billCode: string;
  status: BillStatus;
  amountSen: Sen;
  feeSen: Sen;
  totalSen: Sen;
  expiresAt: string;
  paidAt: string | null;
  purpose: "publish" | "back";
  wantedId: string;
  wantedTitle: string;
  /** Whether the Wanted is on the Board now. */
  wantedOpen: boolean;
}

export interface ProviderCallback {
  provider: PaymentProviderName;
  providerBillId: string;
  providerTransactionId: string;
  merchantCode: string;
  /** What the provider collected: the contribution plus the fee. */
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
export type ReadPayerBillResult = OperationResult<PayerBill, MoneyOperationCode>;
export type MockCheckoutResult = OperationResult<
  { billCode: string; returnUrl: string },
  MoneyOperationCode
>;
export type HandleProviderCallbackResult = OperationResult<
  { accepted: true; duplicate: boolean },
  MoneyOperationCode
>;
