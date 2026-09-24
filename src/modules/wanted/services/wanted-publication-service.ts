import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  CURRENT_POLICY_VERSION,
  duplicateSuggestionInputSchema,
  freePublicationInputSchema,
  publicationInputSchema,
  type PrepareWantedPublicationResult,
  type PublishFreeWantedResult,
  type SuggestWantedDuplicatesResult,
} from "@/contracts/marketplace";
import { failure, success } from "@/contracts/operation-result";
import { rankDuplicateCandidates } from "../domain/duplicate-ranking";
import { canManageWantedDraft, type WantedActor } from "../domain/wanted-policy";
import type { StoredWantedDraft, WantedRepository } from "../repositories/wanted-repository";

/** Opens a draft with no bounty. Implemented by the Supabase repository. */
export interface FreeWantedPublisher {
  publishFree(input: {
    draftId: string;
    tokenHash: string;
    criteriaHash: string;
    policyVersion: string;
  }): Promise<{ outcome: "published" | "required" | "expired"; publicId: string | null }>;
}

interface PublicationOptions {
  freePublisher?: FreeWantedPublisher;
  now?: () => Date;
  token?: () => string;
  paymentAvailability: "disabled" | "unavailable" | "ready";
  feeRateBasisPoints?: number;
  policyVersion?: string;
  tokenSecret?: string;
}

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const criteriaHash = (draft: StoredWantedDraft) => hash(JSON.stringify(draft.values));

export class WantedPublicationService {
  private readonly now: () => Date;
  private readonly token: () => string;
  private readonly paymentAvailability: PublicationOptions["paymentAvailability"];
  private readonly feeRateBasisPoints: number;
  private readonly policyVersion: string;
  private readonly tokenSecret: string;
  private readonly freePublisher: FreeWantedPublisher | null;

  constructor(
    private readonly repository: WantedRepository,
    options: PublicationOptions,
  ) {
    this.now = options.now ?? (() => new Date());
    this.token = options.token ?? (() => randomBytes(32).toString("base64url"));
    this.paymentAvailability = options.paymentAvailability;
    this.feeRateBasisPoints = options.feeRateBasisPoints ?? 1000;
    this.policyVersion = options.policyVersion ?? CURRENT_POLICY_VERSION;
    this.tokenSecret = options.tokenSecret ?? "vaultix-local-marketplace-token-secret";
    this.freePublisher = options.freePublisher ?? null;
  }

  /**
   * Opens an academic draft as a free request: no bounty, no payment step and
   * no fee. The duplicate check is still required and consumed once. Payment
   * mode does not matter here, because nothing is charged.
   */
  async publishFree(actor: WantedActor | null, input: unknown): Promise<PublishFreeWantedResult> {
    const eligibility = this.eligibility(actor);
    if (eligibility) return eligibility;
    const parsed = freePublicationInputSchema.safeParse(input);
    if (!parsed.success) return failure("VALIDATION_ERROR", "A valid duplicate check is required.");
    if (!this.hasValidSignature(parsed.data.duplicateCheckToken)) {
      return failure("DUPLICATE_CHECK_REQUIRED", "Run a fresh duplicate check for this draft.");
    }
    if (this.freePublisher === null) {
      return failure(
        "MARKETPLACE_UNAVAILABLE",
        "Publishing is temporarily unavailable. Try again.",
      );
    }
    try {
      const draft = await this.editableDraft(actor!, parsed.data.draftId);
      if (!draft.ok) return draft.result;
      const published = await this.freePublisher.publishFree({
        criteriaHash: criteriaHash(draft.value),
        draftId: draft.value.id,
        policyVersion: this.policyVersion,
        tokenHash: hash(parsed.data.duplicateCheckToken),
      });
      if (published.outcome === "expired") {
        return failure("DUPLICATE_CHECK_EXPIRED", "Run the duplicate check again before posting.");
      }
      if (published.outcome === "required" || published.publicId === null) {
        return failure("DUPLICATE_CHECK_REQUIRED", "Run a fresh duplicate check for this draft.");
      }
      return success({ state: "open", wantedId: published.publicId });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        String((error as { message: unknown }).message).includes("wanted_free_limit_reached")
      ) {
        return failure("FREE_LIMIT_REACHED", "");
      }
      return failure(
        "MARKETPLACE_UNAVAILABLE",
        "Publishing is temporarily unavailable. Try again.",
      );
    }
  }

  async suggestDuplicates(
    actor: WantedActor | null,
    input: unknown,
  ): Promise<SuggestWantedDuplicatesResult> {
    const eligibility = this.eligibility(actor);
    if (eligibility) return eligibility;
    const parsed = duplicateSuggestionInputSchema.safeParse(input);
    if (!parsed.success) return failure("VALIDATION_ERROR", "A valid Wanted draft is required.");
    try {
      const draft = await this.editableDraft(actor!, parsed.data.draftId);
      if (!draft.ok) return draft.result;
      const nonce = this.token();
      const issuedToken = `${nonce}.${this.sign(nonce)}`;
      const expiresAt = new Date(this.now().getTime() + 15 * 60_000).toISOString();
      await this.repository.storeDuplicateCheck({
        criteriaHash: criteriaHash(draft.value),
        draftId: draft.value.id,
        expiresAt,
        tokenHash: hash(issuedToken),
      });
      const suggestions = rankDuplicateCandidates(
        {
          academicSessionId: draft.value.values.academicSessionId,
          courseId: draft.value.values.courseId,
          resourceTypeId: draft.value.values.resourceTypeId,
          title: draft.value.values.title,
        },
        await this.repository.listDuplicateCandidates(draft.value),
      );
      return success({ expiresAt, suggestions, token: issuedToken });
    } catch {
      return failure(
        "MARKETPLACE_UNAVAILABLE",
        "Duplicate checking is temporarily unavailable. Try again.",
      );
    }
  }

  async preparePublication(
    actor: WantedActor | null,
    input: unknown,
  ): Promise<PrepareWantedPublicationResult> {
    const eligibility = this.eligibility(actor);
    if (eligibility) return eligibility;
    const parsed = publicationInputSchema.safeParse(input);
    if (!parsed.success) {
      return failure("VALIDATION_ERROR", "Check the contribution and duplicate check.");
    }
    if (this.paymentAvailability === "disabled") {
      return failure(
        "PAYMENT_DISABLED",
        "Payments are currently disabled; your draft remains editable.",
      );
    }
    if (this.paymentAvailability === "unavailable") {
      return failure(
        "PAYMENT_UNAVAILABLE",
        "Payment preparation is temporarily unavailable; your draft remains editable.",
      );
    }
    if (!this.hasValidSignature(parsed.data.duplicateCheckToken)) {
      return failure("DUPLICATE_CHECK_REQUIRED", "Run a fresh duplicate check for this draft.");
    }
    try {
      const draft = await this.editableDraft(actor!, parsed.data.draftId);
      if (!draft.ok) return draft.result;
      const prepared = await this.repository.preparePublication({
        accessBasis: "contributors_only",
        amountSen: parsed.data.initialContributionSen,
        commissionerUserId: actor!.userId,
        criteriaHash: criteriaHash(draft.value),
        draftId: draft.value.id,
        durationDays: draft.value.values.durationDays,
        feeRateBasisPoints: this.feeRateBasisPoints,
        policyVersion: this.policyVersion,
        tokenHash: hash(parsed.data.duplicateCheckToken),
      });
      if (prepared === "expired") {
        return failure(
          "DUPLICATE_CHECK_EXPIRED",
          "Run the duplicate check again before continuing.",
        );
      }
      if (prepared === "required") {
        return failure("DUPLICATE_CHECK_REQUIRED", "Run a fresh duplicate check for this draft.");
      }
      return success({
        draftId: draft.value.id,
        paymentRequired: true,
        state: "awaiting_payment",
      });
    } catch {
      return failure(
        "MARKETPLACE_UNAVAILABLE",
        "Publication preparation is temporarily unavailable. Try again.",
      );
    }
  }

  private eligibility(actor: WantedActor | null) {
    const denial = canManageWantedDraft(actor);
    return denial
      ? failure(denial, "Your account is not eligible for this marketplace operation.")
      : null;
  }

  private sign(nonce: string): string {
    return createHmac("sha256", this.tokenSecret).update(nonce).digest("hex");
  }

  private hasValidSignature(token: string): boolean {
    const [nonce, signature, extra] = token.split(".");
    if (!nonce || !signature || extra !== undefined || !/^[0-9a-f]{64}$/.test(signature)) {
      return false;
    }
    const expected = Buffer.from(this.sign(nonce), "hex");
    const received = Buffer.from(signature, "hex");
    return expected.length === received.length && timingSafeEqual(expected, received);
  }

  private async editableDraft(actor: WantedActor, draftId: string) {
    const draft = await this.repository.findDraft(draftId, actor.userId);
    if (!draft) {
      return {
        ok: false as const,
        result: failure("DRAFT_NOT_FOUND", "Wanted draft not found."),
      };
    }
    if (draft.state !== "draft") {
      return {
        ok: false as const,
        result: failure("DRAFT_NOT_EDITABLE", "This Wanted can no longer be edited as a draft."),
      };
    }
    return { ok: true as const, value: draft };
  }
}
