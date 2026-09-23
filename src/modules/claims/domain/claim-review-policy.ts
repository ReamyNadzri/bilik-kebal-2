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

export type AppealSubmissionInput = {
  actorUserId: string;
  hunterUserId: string;
  claimStatus: string;
  reviewCreatedAt: string | Date;
  now?: string | Date;
  hasExistingAppeal: boolean;
};

export type AppealSubmissionResult =
  | { ok: true; deadline: Date }
  | {
      ok: false;
      code:
        | "NOT_CLAIM_OWNER"
        | "CLAIM_NOT_ELIGIBLE_FOR_APPEAL"
        | "APPEAL_WINDOW_EXPIRED"
        | "APPEAL_ALREADY_EXISTS";
    };

export function evaluateAppealSubmission(input: AppealSubmissionInput): AppealSubmissionResult {
  const { actorUserId, hunterUserId, claimStatus, reviewCreatedAt, hasExistingAppeal } = input;
  if (actorUserId !== hunterUserId) {
    return { ok: false, code: "NOT_CLAIM_OWNER" };
  }
  if (claimStatus !== "rejected" && claimStatus !== "restricted") {
    return { ok: false, code: "CLAIM_NOT_ELIGIBLE_FOR_APPEAL" };
  }
  if (hasExistingAppeal) {
    return { ok: false, code: "APPEAL_ALREADY_EXISTS" };
  }

  const reviewTime = new Date(reviewCreatedAt).getTime();
  const deadline = new Date(reviewTime + 7 * 24 * 60 * 60 * 1000);
  const currentTime = input.now ? new Date(input.now).getTime() : Date.now();

  if (currentTime > deadline.getTime()) {
    return { ok: false, code: "APPEAL_WINDOW_EXPIRED" };
  }

  return { ok: true, deadline };
}

export type AppealReviewInput = {
  actor: ClaimReviewActor;
  originalReviewerUserId: string;
  appellantUserId: string;
  appealStatus: string;
};

export type AppealReviewResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | "SEGREGATION_VIOLATION"
        | "CANNOT_REVIEW_OWN_APPEAL"
        | "REVIEWER_NOT_AUTHORIZED"
        | "APPEAL_NOT_PENDING";
    };

export function evaluateAppealReview(input: AppealReviewInput): AppealReviewResult {
  const { actor, originalReviewerUserId, appellantUserId, appealStatus } = input;

  if (appealStatus !== "pending") {
    return { ok: false, code: "APPEAL_NOT_PENDING" };
  }

  // Segregation of Duties: Original reviewer cannot review appeal
  if (actor.userId === originalReviewerUserId) {
    return { ok: false, code: "SEGREGATION_VIOLATION" };
  }

  // Appellant cannot review their own appeal
  if (actor.userId === appellantUserId) {
    return { ok: false, code: "CANNOT_REVIEW_OWN_APPEAL" };
  }

  if (!actor.isOwner && (!actor.isSheriff || !actor.sameInstitution)) {
    return { ok: false, code: "REVIEWER_NOT_AUTHORIZED" };
  }

  return { ok: true };
}

export type ClaimReportPolicyInput = {
  category: string;
};

export type ClaimReportPolicyResult = {
  isHighRisk: boolean;
  requiresImmediateRestriction: boolean;
};

export function evaluateClaimReport(input: ClaimReportPolicyInput): ClaimReportPolicyResult {
  const highRiskCategories = ["personal_data", "malware", "fraud"];
  const isHighRisk = highRiskCategories.includes(input.category);
  return {
    isHighRisk,
    requiresImmediateRestriction: isHighRisk,
  };
}
