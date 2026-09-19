import { describe, expect, it, vi } from "vitest";
import { ClaimReviewService, type ClaimReviewRepository } from "./claim-review-service";

describe("claim review service", () => {
  it("rejects malformed decisions before persistence", async () => {
    const repository: ClaimReviewRepository = { listQueue: vi.fn(), recordReview: vi.fn() };
    const result = await new ClaimReviewService(repository).record({
      claimId: "bad",
      decision: "approve",
    });
    expect(result).toEqual({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Check the review details.",
    });
    expect(repository.recordReview).not.toHaveBeenCalled();
  });

  it("records a validated human review", async () => {
    const repository: ClaimReviewRepository = {
      listQueue: vi.fn(),
      recordReview: vi.fn().mockResolvedValue("review-1"),
    };
    await expect(
      new ClaimReviewService(repository).record({
        claimId: "00000000-0000-4000-8000-000000000001",
        decision: "approve",
        reasonCode: "rights_confirmed",
      }),
    ).resolves.toEqual({ ok: true, data: { reviewId: "review-1" } });
  });
});
