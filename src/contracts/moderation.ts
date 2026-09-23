import { z } from "zod";
import type { OperationResult } from "./operation-result";

export const CLAIM_REPORT_CATEGORIES = [
  "restricted_material",
  "rights_issue",
  "wrong_file",
  "personal_data",
  "malware",
  "fraud",
  "other",
] as const;

export type ClaimReportCategory = (typeof CLAIM_REPORT_CATEGORIES)[number];

export const HIGH_RISK_REPORT_CATEGORIES = ["personal_data", "malware", "fraud"] as const;
export type HighRiskReportCategory = (typeof HIGH_RISK_REPORT_CATEGORIES)[number];

export function isHighRiskReportCategory(category: ClaimReportCategory): boolean {
  return (HIGH_RISK_REPORT_CATEGORIES as readonly string[]).includes(category);
}

export const CLAIM_REJECTION_REASON_CODES = [
  "wrong_academic_course",
  "incomplete_material",
  "corrupted_or_unreadable",
  "prohibited_exam_paper",
  "academic_integrity_violation",
  "copyright_infringement",
  "poor_quality",
  "duplicate_submission",
] as const;

export const CLAIM_APPROVAL_REASON_CODES = [
  "verified_complete_syllabus",
  "highest_quality_notes",
  "approved_winning_submission",
] as const;

export const CLAIM_NEEDS_INFO_REASON_CODES = [
  "missing_pages_or_index",
  "illegible_handwriting",
  "clarify_edition",
] as const;

export const APPEAL_DECISION_REASON_CODES = [
  "evidence_substantiated",
  "decision_upheld_policy_violation",
  "decision_upheld_low_quality",
  "decision_overturned_evidence_valid",
  "appeal_dismissed_untimely",
] as const;

export const claimReportInputSchema = z.object({
  claimId: z.string().uuid(),
  category: z.enum(CLAIM_REPORT_CATEGORIES),
  description: z.string().trim().min(10, "Description must be at least 10 characters.").max(2000),
});

export type ClaimReportInput = z.infer<typeof claimReportInputSchema>;

export const claimAppealInputSchema = z.object({
  claimId: z.string().uuid(),
  reason: z.string().trim().min(10, "Appeal reason must be at least 10 characters.").max(2000),
});

export type ClaimAppealInput = z.infer<typeof claimAppealInputSchema>;

export const claimAppealDecisionSchema = z.object({
  appealId: z.string().uuid(),
  decision: z.enum(["upheld", "overturned", "dismissed"]),
  reasonCode: z
    .string()
    .regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/)
    .max(80),
  notes: z.string().max(2000).nullable().optional(),
});

export type ClaimAppealDecisionInput = z.infer<typeof claimAppealDecisionSchema>;

export type ModerationOperationCode =
  | "AUTH_REQUIRED"
  | "NOT_AUTHORIZED"
  | "CLAIM_NOT_FOUND"
  | "CLAIM_NOT_REJECTED"
  | "APPEAL_EXPIRED"
  | "APPEAL_ALREADY_EXISTS"
  | "SEGREGATION_VIOLATION"
  | "CANNOT_REVIEW_OWN_APPEAL"
  | "MODERATION_UNAVAILABLE"
  | "VALIDATION_ERROR";

export interface ClaimReportDetails {
  id: string;
  claimId: string;
  reporterUserId: string;
  category: ClaimReportCategory;
  description: string;
  isHighRisk: boolean;
  status: "pending" | "investigating" | "resolved" | "dismissed";
  createdAt: string;
}

export interface ClaimAppealDetails {
  id: string;
  claimId: string;
  originalReviewId: string;
  appellantUserId: string;
  reason: string;
  status: "pending" | "upheld" | "overturned" | "dismissed";
  appealDeadline: string;
  createdAt: string;
  decidedAt?: string | null;
  reviewerUserId?: string | null;
  decision?: "upheld" | "overturned" | "dismissed" | null;
  decisionReasonCode?: string | null;
  decisionNotes?: string | null;
}

export type SubmitClaimReportResult = OperationResult<
  { reportId: string; isRestricted: boolean },
  ModerationOperationCode
>;
export type SubmitClaimAppealResult = OperationResult<
  { appealId: string; deadline: string },
  ModerationOperationCode
>;
export type DecideClaimAppealResult = OperationResult<
  { appealId: string; newClaimStatus: string },
  ModerationOperationCode
>;
