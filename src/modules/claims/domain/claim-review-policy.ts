import type { ClaimScreeningStatus } from "@/contracts/claim-screening";

export type ClaimReviewDecision = "approve" | "reject" | "request_information";

export type ClaimReviewActor = {
  userId: string;
  isSheriff: boolean;
  sameInstitution: boolean;
  isOwner: boolean;
};

export type ClaimReviewInput = {
  actor: ClaimReviewActor;
  screeningStatus: ClaimScreeningStatus;
  decision: ClaimReviewDecision;
  rightsConfirmed: boolean;
};

export type ClaimReviewResult =
  | { ok: true; decision: ClaimReviewDecision }
  | {
      ok: false;
      code: "REVIEWER_NOT_AUTHORIZED" | "SCREENING_INCOMPLETE" | "RIGHTS_CONFIRMATION_REQUIRED";
    };

export function evaluateClaimReview(input: ClaimReviewInput): ClaimReviewResult {
  const { actor, screeningStatus, decision, rightsConfirmed } = input;
  if (!actor.isOwner && (!actor.isSheriff || !actor.sameInstitution)) {
    return { ok: false, code: "REVIEWER_NOT_AUTHORIZED" };
  }
  if (screeningStatus === "error" || screeningStatus === "needs_review") {
    return { ok: false, code: "SCREENING_INCOMPLETE" };
  }
  if (decision === "approve" && !rightsConfirmed) {
    return { ok: false, code: "RIGHTS_CONFIRMATION_REQUIRED" };
  }
  return { ok: true, decision };
}
