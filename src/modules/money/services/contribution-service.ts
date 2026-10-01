import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  backingIntentInputSchema,
  chargeBreakdown,
  contributionIntentInputSchema,
  PLATFORM_FEE_BASIS_POINTS,
  type BillView,
  type CreateContributionIntentResult,
  type HandleProviderCallbackResult,
  type MockCheckoutResult,
  type MoneyOperationCode,
  type ReadPayerBillResult,
  type ToyyibPayRawCallback,
  type VerifiedProviderCallback,
} from "@/contracts/money";
import { failure, success } from "@/contracts/operation-result";
import type { PaymentMode } from "@/lib/config/server-env";
import { canManageWantedDraft, type WantedActor } from "@/modules/wanted/domain/wanted-policy";
import type { MoneyRepository } from "../repositories/money-repository";
import type { PaymentProvider } from "../providers/payment-provider";
import { isMockBillCode, type MockPaymentGateway } from "../providers/mock-gateway";

interface ContributionOptions {
  paymentMode: PaymentMode;
  tokenSecret: string;
}

function databaseMessage(error: unknown): string {
  return typeof error === "object" && error !== null && "message" in error
    ? String((error as { message: unknown }).message)
    : "";
}

/** Database refusals a payer can act on; anything else is "unavailable". */
const DATABASE_REFUSALS: readonly [string, MoneyOperationCode, string][] = [
  [
    "payment_details_required",
    "PAYMENT_DETAILS_REQUIRED",
    "Add your phone number and bank account to your profile before paying. Refunds are paid there.",
  ],
  ["wanted_not_open", "WANTED_NOT_FOUND", "This Wanted is no longer open for backing."],
  ["wanted_editable_draft_not_found", "DRAFT_NOT_EDITABLE", "This draft can no longer be paid."],
  [
    "wanted_duplicate_check_expired",
    "DUPLICATE_CHECK_EXPIRED",
    "The similar-request check expired. Run it again before paying.",
  ],
  [
    "wanted_duplicate_check_required",
    "DUPLICATE_CHECK_REQUIRED",
    "Run a fresh duplicate check before payment.",
  ],
];

function refusalFor(error: unknown): CreateContributionIntentResult {
  const message = databaseMessage(error);
  const refusal = DATABASE_REFUSALS.find(([needle]) => message.includes(needle));
  return refusal
    ? failure(refusal[1], refusal[2])
    : failure("PAYMENT_UNAVAILABLE", "Payment preparation is temporarily unavailable.");
}

/**
 * Prepares bills for a contribution and records verified provider events.
 *
 * A payer is billed the contribution plus the platform fee on top; the
 * contribution alone goes to the bounty. The provider only prepares a bill:
 * nothing here marks anything paid. Only a verified provider event does, once,
 * through `record_verified_contribution`.
 */
export class ContributionService {
  constructor(
    private readonly repository: MoneyRepository,
    private readonly provider: PaymentProvider,
    private readonly options: ContributionOptions,
  ) {}

  /** The first contribution, which publishes a checked draft once paid. */
  async createIntent(
    actor: WantedActor | null,
    rawInput: unknown,
  ): Promise<CreateContributionIntentResult> {
    const denial = canManageWantedDraft(actor);
    if (denial) return failure(denial, "Your account is not eligible for payment.");
    if (this.options.paymentMode === "disabled")
      return failure("PAYMENT_DISABLED", "Payments are currently disabled.");
    const parsed = contributionIntentInputSchema.safeParse(rawInput);
    if (!parsed.success)
      return failure("AMOUNT_OUT_OF_RANGE", "Contribution must be between RM1 and RM50.");
    if (!this.hasValidDuplicateToken(parsed.data.duplicateCheckToken))
      return failure("DUPLICATE_CHECK_REQUIRED", "Run a fresh duplicate check before payment.");
    try {
      const draft = await this.repository.findDraftForContribution(
        parsed.data.draftId,
        actor!.userId,
      );
      if (!draft) return failure("DRAFT_NOT_FOUND", "Wanted draft not found.");
      if (draft.state !== "draft")
        return failure("DRAFT_NOT_EDITABLE", "This Wanted draft is no longer editable.");
      const missingDetails = await this.missingPaymentDetails();
      if (missingDetails) return missingDetails;
      const charge = chargeBreakdown(parsed.data.amountSen, PLATFORM_FEE_BASIS_POINTS);
      const providerBill = await this.provider.createBill({
        amountSen: charge.totalSen,
        reference: draft.id,
      });
      const { intentId } = await this.repository.createContributionIntent({
        amountSen: charge.amountSen,
        draftId: draft.id,
        duplicateCheckTokenHash: createHash("sha256")
          .update(parsed.data.duplicateCheckToken)
          .digest("hex"),
        feeSen: charge.feeSen,
        provider: this.provider.name,
        providerBill,
        userId: actor!.userId,
      });
      return success(this.billView(intentId, charge, providerBill));
    } catch (error) {
      return refusalFor(error);
    }
  }

  /** A Backer adding to an open Wanted's bounty. */
  async createBackingIntent(
    actor: WantedActor | null,
    rawInput: unknown,
  ): Promise<CreateContributionIntentResult> {
    const denial = canManageWantedDraft(actor);
    if (denial) return failure(denial, "Your account is not eligible for payment.");
    if (this.options.paymentMode === "disabled")
      return failure("PAYMENT_DISABLED", "Payments are currently disabled.");
    const parsed = backingIntentInputSchema.safeParse(rawInput);
    if (!parsed.success)
      return failure("AMOUNT_OUT_OF_RANGE", "Contribution must be between RM1 and RM50.");
    try {
      const feeRate = await this.repository.readBackingFeeRate(parsed.data.wantedId);
      if (feeRate === null)
        return failure("WANTED_NOT_FOUND", "This Wanted is no longer open for backing.");
      const missingDetails = await this.missingPaymentDetails();
      if (missingDetails) return missingDetails;
      const charge = chargeBreakdown(parsed.data.amountSen, feeRate);
      const providerBill = await this.provider.createBill({
        amountSen: charge.totalSen,
        reference: parsed.data.wantedId,
      });
      const { intentId } = await this.repository.createBackingIntent({
        amountSen: charge.amountSen,
        feeSen: charge.feeSen,
        provider: this.provider.name,
        providerBill,
        wantedPublicId: parsed.data.wantedId,
      });
      return success(this.billView(intentId, charge, providerBill));
    } catch (error) {
      return refusalFor(error);
    }
  }

  /** The payer's own bill, read from the database, never from a redirect. */
  async readBill(actor: WantedActor | null, billCode: string): Promise<ReadPayerBillResult> {
    if (actor === null) return failure("AUTH_REQUIRED", "Sign in to see this payment.");
    if (billCode.length < 1 || billCode.length > 160)
      return failure("PAYMENT_BILL_NOT_FOUND", "This payment was not found on your account.");
    try {
      const bill = await this.repository.readOwnBill(billCode);
      return bill
        ? success(bill)
        : failure("PAYMENT_BILL_NOT_FOUND", "This payment was not found on your account.");
    } catch {
      return failure("MONEY_UNAVAILABLE", "Payments are temporarily unavailable.");
    }
  }

  async handleVerifiedCallback(
    callback: VerifiedProviderCallback,
  ): Promise<HandleProviderCallbackResult> {
    try {
      const outcome = await this.repository.recordVerifiedContribution(callback);
      if (outcome === "accepted") return success({ accepted: true, duplicate: false });
      if (outcome === "duplicate") return success({ accepted: true, duplicate: true });
      if (outcome === "unknown")
        return failure("MONEY_UNAVAILABLE", "The payment event is waiting for its bill record.");
      return failure("PAYMENT_PROVIDER_REJECTED", "The payment event was not accepted.");
    } catch {
      return failure("MONEY_UNAVAILABLE", "Payment events are temporarily unavailable.");
    }
  }

  async handleCallback(callback: ToyyibPayRawCallback): Promise<HandleProviderCallbackResult> {
    const verified = this.provider.verifyCallback(callback);
    if (!verified.ok) return failure("PAYMENT_CALLBACK_INVALID", "Callback verification failed.");
    return this.handleVerifiedCallback(verified.data);
  }

  private async missingPaymentDetails(): Promise<CreateContributionIntentResult | null> {
    return (await this.repository.hasOwnPaymentDetails())
      ? null
      : failure(
          "PAYMENT_DETAILS_REQUIRED",
          "Add your phone number and bank account to your profile before paying. Refunds are paid there.",
        );
  }

  private billView(
    intentId: string,
    charge: ReturnType<typeof chargeBreakdown>,
    providerBill: { paymentUrl: string; expiresAt: string },
  ): BillView {
    return {
      amountSen: charge.amountSen,
      expiresAt: providerBill.expiresAt,
      feeSen: charge.feeSen,
      id: intentId,
      paymentUrl: providerBill.paymentUrl,
      provider: this.provider.name,
      status: "pending",
      totalSen: charge.totalSen,
    };
  }

  private hasValidDuplicateToken(token: string): boolean {
    const [nonce, signature, extra] = token.split(".");
    if (!nonce || !signature || extra !== undefined || !/^[0-9a-f]{64}$/i.test(signature))
      return false;
    const expected = Buffer.from(
      createHmac("sha256", this.options.tokenSecret).update(nonce).digest("hex"),
      "hex",
    );
    const received = Buffer.from(signature, "hex");
    return expected.length === received.length && timingSafeEqual(expected, received);
  }
}

/**
 * The test gateway's checkout: the payer pays or cancels their own pending
 * bill. Paying produces a signed provider event that goes through the same
 * verified, exactly-once path a ToyyibPay callback takes (`ledger`, which
 * runs with the privileged repository); cancelling fails the bill.
 */
export class MockCheckoutService {
  constructor(
    private readonly payer: Pick<MoneyRepository, "readOwnBill" | "cancelOwnBill">,
    private readonly ledger: Pick<ContributionService, "handleCallback">,
    private readonly gateway: MockPaymentGateway,
    private readonly options: { paymentMode: PaymentMode; now?: () => Date },
  ) {}

  async complete(
    actor: WantedActor | null,
    billCode: string,
    outcome: "paid" | "cancelled",
  ): Promise<MockCheckoutResult> {
    if (actor === null) return failure("AUTH_REQUIRED", "Sign in to finish this payment.");
    if (this.options.paymentMode !== "mock")
      return failure("PAYMENT_DISABLED", "The test payment gateway is switched off.");
    if (!isMockBillCode(billCode))
      return failure("PAYMENT_BILL_NOT_FOUND", "This payment was not found on your account.");
    const returnUrl = `/payment/return?bill=${encodeURIComponent(billCode)}`;
    try {
      const bill = await this.payer.readOwnBill(billCode);
      if (!bill || bill.provider !== "mock")
        return failure("PAYMENT_BILL_NOT_FOUND", "This payment was not found on your account.");
      if (bill.status !== "pending") return success({ billCode, returnUrl });
      if (outcome === "cancelled") {
        await this.payer.cancelOwnBill(billCode);
        return success({ billCode, returnUrl });
      }
      const now = this.options.now?.() ?? new Date();
      if (new Date(bill.expiresAt).getTime() <= now.getTime())
        return failure("PAYMENT_BILL_CLOSED", "This bill has expired. Nothing was charged.");
      const result = await this.ledger.handleCallback(
        this.gateway.signEvent({ billCode, outcome: "paid", totalSen: bill.totalSen }),
      );
      if (!result.ok && result.code !== "PAYMENT_PROVIDER_REJECTED") return result;
      return success({ billCode, returnUrl });
    } catch {
      return failure("MONEY_UNAVAILABLE", "Payments are temporarily unavailable.");
    }
  }
}
