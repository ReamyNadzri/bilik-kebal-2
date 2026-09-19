import { describe, expect, it } from "vitest";
import { evaluateClaimReview } from "./claim-review-policy";

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
});
