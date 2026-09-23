import { describe, expect, it } from "vitest";
import {
  evaluateAppealReview,
  evaluateAppealSubmission,
  evaluateClaimReport,
  evaluateClaimReview,
} from "./claim-review-policy";

const sheriff = { userId: "sheriff", isSheriff: true, sameInstitution: true, isOwner: false };

describe("claim review policy", () => {
  it("requires a human Sheriff and rights confirmation to approve", () => {
    expect(
      evaluateClaimReview({
        actor: sheriff,
        screeningStatus: "clean",
        decision: "approve",
        rightsConfirmed: true,
      }),
    ).toEqual({ ok: true, decision: "approve" });
  });

  it("does not let screening status approve a claim", () => {
    expect(
      evaluateClaimReview({
        actor: sheriff,
        screeningStatus: "needs_review",
        decision: "approve",
        rightsConfirmed: true,
      }),
    ).toEqual({ ok: false, code: "SCREENING_INCOMPLETE" });
  });

  it("rejects cross institution reviewers", () => {
    expect(
      evaluateClaimReview({
        actor: { ...sheriff, sameInstitution: false },
        screeningStatus: "clean",
        decision: "reject",
        rightsConfirmed: false,
      }),
    ).toEqual({ ok: false, code: "REVIEWER_NOT_AUTHORIZED" });
  });

  describe("appeal submission policy", () => {
    const reviewDate = "2026-09-01T10:00:00Z";

    it("accepts appeal submitted by hunter within 7 days", () => {
      const result = evaluateAppealSubmission({
        actorUserId: "hunter-1",
        hunterUserId: "hunter-1",
        claimStatus: "rejected",
        reviewCreatedAt: reviewDate,
        now: "2026-09-06T10:00:00Z", // 5 days later
        hasExistingAppeal: false,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.deadline.toISOString()).toBe("2026-09-08T10:00:00.000Z");
      }
    });

    it("rejects appeal submitted after 7 days", () => {
      const result = evaluateAppealSubmission({
        actorUserId: "hunter-1",
        hunterUserId: "hunter-1",
        claimStatus: "rejected",
        reviewCreatedAt: reviewDate,
        now: "2026-09-08T10:00:01Z", // 7 days + 1 sec
        hasExistingAppeal: false,
      });
      expect(result).toEqual({ ok: false, code: "APPEAL_WINDOW_EXPIRED" });
    });

    it("rejects appeal submitted by someone other than the hunter", () => {
      const result = evaluateAppealSubmission({
        actorUserId: "random-user",
        hunterUserId: "hunter-1",
        claimStatus: "rejected",
        reviewCreatedAt: reviewDate,
        now: "2026-09-02T10:00:00Z",
        hasExistingAppeal: false,
      });
      expect(result).toEqual({ ok: false, code: "NOT_CLAIM_OWNER" });
    });

    it("rejects appeal if claim is not rejected or restricted", () => {
      const result = evaluateAppealSubmission({
        actorUserId: "hunter-1",
        hunterUserId: "hunter-1",
        claimStatus: "under_review",
        reviewCreatedAt: reviewDate,
        now: "2026-09-02T10:00:00Z",
        hasExistingAppeal: false,
      });
      expect(result).toEqual({ ok: false, code: "CLAIM_NOT_ELIGIBLE_FOR_APPEAL" });
    });

    it("rejects appeal if one already exists", () => {
      const result = evaluateAppealSubmission({
        actorUserId: "hunter-1",
        hunterUserId: "hunter-1",
        claimStatus: "rejected",
        reviewCreatedAt: reviewDate,
        now: "2026-09-02T10:00:00Z",
        hasExistingAppeal: true,
      });
      expect(result).toEqual({ ok: false, code: "APPEAL_ALREADY_EXISTS" });
    });
  });

  describe("appeal review policy (segregation of duties)", () => {
    const originalSheriff = {
      userId: "sheriff-1",
      isSheriff: true,
      sameInstitution: true,
      isOwner: false,
    };
    const secondSheriff = {
      userId: "sheriff-2",
      isSheriff: true,
      sameInstitution: true,
      isOwner: false,
    };

    it("blocks original reviewer from reviewing appeal (segregation of duties)", () => {
      const result = evaluateAppealReview({
        actor: originalSheriff,
        originalReviewerUserId: "sheriff-1",
        appellantUserId: "hunter-1",
        appealStatus: "pending",
      });
      expect(result).toEqual({ ok: false, code: "SEGREGATION_VIOLATION" });
    });

    it("blocks appellant from reviewing their own appeal", () => {
      const result = evaluateAppealReview({
        actor: { userId: "hunter-1", isSheriff: true, sameInstitution: true, isOwner: false },
        originalReviewerUserId: "sheriff-1",
        appellantUserId: "hunter-1",
        appealStatus: "pending",
      });
      expect(result).toEqual({ ok: false, code: "CANNOT_REVIEW_OWN_APPEAL" });
    });

    it("allows a different authorized sheriff to review appeal", () => {
      const result = evaluateAppealReview({
        actor: secondSheriff,
        originalReviewerUserId: "sheriff-1",
        appellantUserId: "hunter-1",
        appealStatus: "pending",
      });
      expect(result).toEqual({ ok: true });
    });

    it("rejects cross-institution sheriff from reviewing appeal", () => {
      const result = evaluateAppealReview({
        actor: { ...secondSheriff, sameInstitution: false },
        originalReviewerUserId: "sheriff-1",
        appellantUserId: "hunter-1",
        appealStatus: "pending",
      });
      expect(result).toEqual({ ok: false, code: "REVIEWER_NOT_AUTHORIZED" });
    });
  });

  describe("claim report policy", () => {
    it("flags personal_data, malware, fraud as high-risk and requiring immediate restriction", () => {
      expect(evaluateClaimReport({ category: "personal_data" })).toEqual({
        isHighRisk: true,
        requiresImmediateRestriction: true,
      });
      expect(evaluateClaimReport({ category: "malware" })).toEqual({
        isHighRisk: true,
        requiresImmediateRestriction: true,
      });
      expect(evaluateClaimReport({ category: "fraud" })).toEqual({
        isHighRisk: true,
        requiresImmediateRestriction: true,
      });
    });

    it("does not flag wrong_file as immediate high-risk restriction", () => {
      expect(evaluateClaimReport({ category: "wrong_file" })).toEqual({
        isHighRisk: false,
        requiresImmediateRestriction: false,
      });
    });
  });
});
