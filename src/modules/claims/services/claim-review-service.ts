import { claimReviewInputSchema, type ClaimReviewQueueItem } from "@/contracts/claim-reviews";
import { failure, success, type OperationResult } from "@/contracts/operation-result";

export interface ClaimReviewRepository {
  listQueue(): Promise<ClaimReviewQueueItem[]>;
  recordReview(input: {
    claimId: string;
    decision: string;
    reasonCode: string;
    notes: string | null;
  }): Promise<string>;
}

export class ClaimReviewService {
  constructor(private readonly repository: ClaimReviewRepository) {}

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
    try {
      const reviewId = await this.repository.recordReview({
        claimId: parsed.data.claimId,
        decision: parsed.data.decision,
        reasonCode: parsed.data.reasonCode,
        notes: parsed.data.notes ?? null,
      });
      return success({ reviewId });
    } catch {
      return failure("REVIEW_UNAVAILABLE", "Review could not be recorded.");
    }
  }
}
