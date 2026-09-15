import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  contributionIntentInputSchema,
  type CreateContributionIntentResult,
  type HandleProviderCallbackResult,
  type ToyyibPayRawCallback,
  type VerifiedProviderCallback,
} from "@/contracts/money";
import { failure, success } from "@/contracts/operation-result";
import { canManageWantedDraft, type WantedActor } from "@/modules/wanted/domain/wanted-policy";
import type { MoneyRepository } from "../repositories/money-repository";
import type { ToyyibPayAdapter } from "../providers/toyyibpay";

interface ContributionOptions {
  paymentMode: "disabled" | "sandbox" | "live_limited";
  tokenSecret: string;
}

export class ContributionService {
  constructor(
    private readonly repository: MoneyRepository,
    private readonly provider: ToyyibPayAdapter,
    private readonly options: ContributionOptions,
  ) {}

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
      const providerBill = await this.provider.createBill({
        amountSen: parsed.data.amountSen,
        reference: draft.id,
      });
      const { intentId } = await this.repository.createContributionIntent({
        amountSen: parsed.data.amountSen,
        draftId: draft.id,
        duplicateCheckTokenHash: createHash("sha256")
          .update(parsed.data.duplicateCheckToken)
          .digest("hex"),
        providerBill,
        userId: actor!.userId,
      });
      return success({
        id: intentId,
        provider: "toyyibpay",
        amountSen: parsed.data.amountSen as never,
        status: "pending",
        paymentUrl: providerBill.paymentUrl,
        expiresAt: providerBill.expiresAt,
      });
    } catch {
      return failure("PAYMENT_UNAVAILABLE", "Payment preparation is temporarily unavailable.");
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
