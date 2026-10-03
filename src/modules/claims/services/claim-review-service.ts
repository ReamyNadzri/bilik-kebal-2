import { claimReviewInputSchema, type ClaimReviewQueueItem } from "@/contracts/claim-reviews";
import { failure, success, type OperationResult } from "@/contracts/operation-result";
import type { PromotionOutcome } from "../storage/promote-approved-claim-file";

export interface ClaimReviewRepository {
  listQueue(): Promise<ClaimReviewQueueItem[]>;
  recordReview(input: {
    claimId: string;
    decision: string;
    reasonCode: string;
    notes: string | null;
  }): Promise<string>;
}

/** Moves an approved claim's file into the approved bucket (server-only, service role). */
export interface ApprovedClaimFilePromoter {
  promote(claimId: string): Promise<PromotionOutcome>;
}

export class ClaimReviewService {
  constructor(
    private readonly repository: ClaimReviewRepository,
    private readonly promoter?: ApprovedClaimFilePromoter,
    private readonly log: (line: string) => void = console.error,
  ) {}

  async listQueue(): Promise<OperationResult<ClaimReviewQueueItem[], "REVIEW_UNAVAILABLE">> {
    try {
      return success(await this.repository.listQueue());
    } catch {
      return failure("REVIEW_UNAVAILABLE", "Review queue is temporarily unavailable.");
    }
  }

  async record(
    input: unknown,
  ): Promise<OperationResult<{ reviewId: string }, "VALIDATION_ERROR" | "REVIEW_UNAVAILABLE">> {
    const parsed = claimReviewInputSchema.safeParse(input);
    if (!parsed.success) return failure("VALIDATION_ERROR", "Check the review details.");
    let reviewId: string;
    try {
      reviewId = await this.repository.recordReview({
        claimId: parsed.data.claimId,
        decision: parsed.data.decision,
        reasonCode: parsed.data.reasonCode,
        notes: parsed.data.notes ?? null,
      });
    } catch {
      return failure("REVIEW_UNAVAILABLE", "Review could not be recorded.");
    }
    if (parsed.data.decision === "approve") {
      await this.promoteFile(parsed.data.claimId);
    }
    return success({ reviewId });
  }

  /**
   * The approval is already committed, so a failed copy never fails the decision.
   * The download path repairs a missing approved file on first use.
   */
  private async promoteFile(claimId: string): Promise<void> {
    if (!this.promoter) return;
    let outcome: PromotionOutcome;
    try {
      outcome = await this.promoter.promote(claimId);
    } catch {
      outcome = "failed";
    }
    if (outcome === "failed") {
      try {
        this.log(JSON.stringify({ event: "claims.approved_file_promotion_failed", claimId }));
      } catch {
        /* Logging failure must not change the outcome. */
      }
    }
  }
}
