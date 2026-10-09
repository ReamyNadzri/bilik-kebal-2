import type { ChargeBreakdown } from "@/contracts/money";

/**
 * Provisional presentation shape of one direct payment request.
 *
 * It stands in for `PaymentRequestView`, which the draft design
 * (`docs/superpowers/specs/2026-10-09-vaultix-direct-payment-draft-design.md`
 * §7) assigns to the backend lane in `src/contracts/direct-payments.ts`. That
 * contract is not published and the design is not approved, so nothing here is
 * a domain type: no service, route or database reads it, and it decides no
 * lifecycle rule. Money reuses the published `ChargeBreakdown`. Replace this
 * file with the published contract in the slice that connects the screen.
 */

/** The draft's proposed public request statuses (§5); `expired` waits on D3. */
export type PaymentRequestStatus =
  "awaiting_payment" | "checking" | "needs_information" | "exception" | "rejected" | "confirmed";

export type PaymentPurpose = "publish" | "back";

/** One saved screenshot on the request. Older versions are never replaced. */
export interface ProofVersionView {
  readonly id: string;
  readonly version: number;
  /** UTC instant from the server. */
  readonly submittedAt: string;
  readonly state: "checking" | "needs_information" | "rejected" | "accepted";
}

/** The Owner's user-safe words on the latest proof: why, and what to do. */
export interface PaymentDecisionView {
  readonly reason: string;
  readonly nextStep: string;
}

export interface PaymentReceiptView {
  readonly receiptNumber: string;
  /** UTC instant the payment was confirmed. */
  readonly confirmedAt: string;
}

/**
 * The ways to pay, from server configuration.
 *
 * Each is null until the Owner supplies it. The screen never draws a QR code,
 * never guesses a link and never falls back to another method: an absent one
 * is shown as absent (draft design §4, D8).
 */
export interface PaymentMethodsView {
  /** The approved name the payer should see in their app as the recipient. */
  readonly recipientName: string | null;
  readonly duitNowQr: { readonly imageSrc: string } | null;
  readonly tngLink: { readonly href: string } | null;
  readonly configVersion: string | null;
}

export interface PaymentRequestViewModel {
  readonly id: string;
  /** Reference the member quotes to support. It is not carried by the QR or link. */
  readonly reference: string;
  readonly purpose: PaymentPurpose;
  readonly status: PaymentRequestStatus;
  readonly wantedId: string;
  readonly wantedTitle: string;
  readonly charge: ChargeBreakdown;
  /** False once the request or its Wanted stops taking new payments. */
  readonly acceptsPayment: boolean;
  readonly proofs: readonly ProofVersionView[];
  readonly decision: PaymentDecisionView | null;
  readonly receipt: PaymentReceiptView | null;
}
