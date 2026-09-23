import { describe, expect, it } from "vitest";
import {
  claimAppealDecisionSchema,
  claimAppealInputSchema,
  claimReportInputSchema,
  isHighRiskReportCategory,
} from "./moderation";

describe("moderation contracts", () => {
  it("validates valid claim reports", () => {
    const valid = {
      claimId: "74000000-0000-4000-8000-000000000001",
      category: "personal_data",
      description: "This document contains full IC numbers and student phone numbers.",
    };
    expect(claimReportInputSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects short or invalid claim report descriptions", () => {
    const invalid = {
      claimId: "74000000-0000-4000-8000-000000000001",
      category: "other",
      description: "too short",
    };
    expect(claimReportInputSchema.safeParse(invalid).success).toBe(false);
  });

  it("correctly identifies high-risk report categories", () => {
    expect(isHighRiskReportCategory("personal_data")).toBe(true);
    expect(isHighRiskReportCategory("malware")).toBe(true);
    expect(isHighRiskReportCategory("fraud")).toBe(true);
    expect(isHighRiskReportCategory("wrong_file")).toBe(false);
    expect(isHighRiskReportCategory("restricted_material")).toBe(false);
  });

  it("validates valid claim appeal input", () => {
    const valid = {
      claimId: "74000000-0000-4000-8000-000000000001",
      reason: "The notes cover the correct 2026 syllabus as verified on page 3.",
    };
    expect(claimAppealInputSchema.safeParse(valid).success).toBe(true);
  });

  it("validates appeal decision schema", () => {
    const valid = {
      appealId: "74000000-0000-4000-8000-000000000002",
      decision: "overturned",
      reasonCode: "decision_overturned_evidence_valid",
      notes: "Reviewed course syllabus comparison and found compliant.",
    };
    expect(claimAppealDecisionSchema.safeParse(valid).success).toBe(true);
  });
});
