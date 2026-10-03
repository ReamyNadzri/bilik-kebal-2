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

describe("claim review service: approved file promotion", () => {
  const CLAIM = "00000000-0000-4000-8000-000000000001";

  function setup(promote = vi.fn().mockResolvedValue("copied")) {
    const repository: ClaimReviewRepository = {
      listQueue: vi.fn(),
      recordReview: vi.fn().mockResolvedValue("payout-1"),
    };
    const log = vi.fn();
    const service = new ClaimReviewService(repository, { promote }, log);
    return { repository, promote, log, service };
  }

  it("copies the claim's file to the approved bucket after an approval", async () => {
    const { service, promote } = setup();
    await expect(
      service.record({ claimId: CLAIM, decision: "approve", reasonCode: "meets_request" }),
    ).resolves.toEqual({ ok: true, data: { reviewId: "payout-1" } });
    expect(promote).toHaveBeenCalledWith(CLAIM);
  });

  it("keeps the recorded approval when the copy fails, logging a code and no key", async () => {
    const { service, log } = setup(vi.fn().mockResolvedValue("failed"));
    await expect(
      service.record({ claimId: CLAIM, decision: "approve", reasonCode: "meets_request" }),
    ).resolves.toMatchObject({ ok: true });
    expect(log).toHaveBeenCalledTimes(1);
    const line = String(log.mock.calls[0]![0]);
    expect(JSON.parse(line)).toEqual({
      event: "claims.approved_file_promotion_failed",
      claimId: CLAIM,
    });
  });

  it("keeps the recorded approval when the copy throws", async () => {
    const { service, log } = setup(vi.fn().mockRejectedValue(new Error("network")));
    await expect(
      service.record({ claimId: CLAIM, decision: "approve", reasonCode: "meets_request" }),
    ).resolves.toMatchObject({ ok: true });
    expect(log).toHaveBeenCalledTimes(1);
  });

  it("treats an object already promoted as success", async () => {
    const { service, log } = setup(vi.fn().mockResolvedValue("already_present"));
    await service.record({ claimId: CLAIM, decision: "approve", reasonCode: "meets_request" });
    expect(log).not.toHaveBeenCalled();
  });

  it("copies nothing for a rejection or an information request", async () => {
    const { service, promote } = setup();
    await service.record({ claimId: CLAIM, decision: "reject", reasonCode: "wrong_file" });
    await service.record({
      claimId: CLAIM,
      decision: "request_information",
      reasonCode: "needs_review",
    });
    expect(promote).not.toHaveBeenCalled();
  });

  it("copies nothing when the approval itself fails", async () => {
    const { service, promote, repository } = setup();
    vi.mocked(repository.recordReview).mockRejectedValue(new Error("denied"));
    await expect(
      service.record({ claimId: CLAIM, decision: "approve", reasonCode: "meets_request" }),
    ).resolves.toMatchObject({ ok: false, code: "REVIEW_UNAVAILABLE" });
    expect(promote).not.toHaveBeenCalled();
  });
});
