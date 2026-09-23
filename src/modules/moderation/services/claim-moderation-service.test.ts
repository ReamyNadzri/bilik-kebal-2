import { describe, expect, it, vi } from "vitest";
import { ClaimModerationService, type ModerationRepository } from "./claim-moderation-service";

function createMockRepository(overrides?: Partial<ModerationRepository>): ModerationRepository {
  return {
    submitReport: vi.fn().mockResolvedValue({ reportId: "report-123" }),
    submitAppeal: vi.fn().mockResolvedValue({
      appealId: "appeal-123",
      deadline: "2026-09-30T10:00:00Z",
    }),
    decideAppeal: vi.fn().mockResolvedValue({
      appealId: "appeal-123",
      newClaimStatus: "under_review",
    }),
    listReports: vi.fn().mockResolvedValue([]),
    listAppeals: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe("ClaimModerationService", () => {
  describe("submitReport", () => {
    it("submits a report and identifies high risk for personal_data", async () => {
      const repo = createMockRepository();
      const service = new ClaimModerationService(repo);

      const result = await service.submitReport({
        claimId: "74000000-0000-4000-8000-000000000001",
        category: "personal_data",
        description: "Student identity cards and phone numbers are exposed on page 2.",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.reportId).toBe("report-123");
        expect(result.data.isRestricted).toBe(true);
      }
      expect(repo.submitReport).toHaveBeenCalledWith({
        claimId: "74000000-0000-4000-8000-000000000001",
        category: "personal_data",
        description: "Student identity cards and phone numbers are exposed on page 2.",
      });
    });

    it("submits a report without restriction for wrong_file", async () => {
      const repo = createMockRepository();
      const service = new ClaimModerationService(repo);

      const result = await service.submitReport({
        claimId: "74000000-0000-4000-8000-000000000001",
        category: "wrong_file",
        description: "This contains syllabus for MAT133 instead of CSC510.",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.isRestricted).toBe(false);
      }
    });

    it("returns validation error on invalid input", async () => {
      const repo = createMockRepository();
      const service = new ClaimModerationService(repo);

      const result = await service.submitReport({
        claimId: "not-a-uuid",
        category: "personal_data",
        description: "short",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("VALIDATION_ERROR");
      }
    });
  });

  describe("submitAppeal", () => {
    it("successfully files an appeal within 7-day window", async () => {
      const repo = createMockRepository();
      const service = new ClaimModerationService(repo);

      const result = await service.submitAppeal({
        claimId: "74000000-0000-4000-8000-000000000001",
        reason: "Page 4 contains the exact course code verification matching the bounty request.",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.appealId).toBe("appeal-123");
      }
    });

    it("handles 7-day expiration gracefully", async () => {
      const repo = createMockRepository({
        submitAppeal: vi.fn().mockRejectedValue(new Error("appeal window has expired (7 days)")),
      });
      const service = new ClaimModerationService(repo);

      const result = await service.submitAppeal({
        claimId: "74000000-0000-4000-8000-000000000001",
        reason: "Page 4 contains the exact course code verification matching the bounty request.",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("APPEAL_EXPIRED");
      }
    });

    it("prevents multiple appeals on the same claim", async () => {
      const repo = createMockRepository({
        submitAppeal: vi
          .fn()
          .mockRejectedValue(new Error("an appeal has already been submitted for this claim")),
      });
      const service = new ClaimModerationService(repo);

      const result = await service.submitAppeal({
        claimId: "74000000-0000-4000-8000-000000000001",
        reason: "Another appeal attempt on the same claim.",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("APPEAL_ALREADY_EXISTS");
      }
    });
  });

  describe("decideAppeal", () => {
    it("handles reviewer segregation error when original reviewer attempts decision", async () => {
      const repo = createMockRepository({
        decideAppeal: vi
          .fn()
          .mockRejectedValue(
            new Error("segregation of duties: original reviewer cannot review appeal"),
          ),
      });
      const service = new ClaimModerationService(repo);

      const result = await service.decideAppeal({
        appealId: "74000000-0000-4000-8000-000000000002",
        decision: "upheld",
        reasonCode: "decision_upheld_policy_violation",
        notes: "I still reject this claim.",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("SEGREGATION_VIOLATION");
      }
    });

    it("successfully records appeal decision when reviewed by a different authorized Sheriff", async () => {
      const repo = createMockRepository();
      const service = new ClaimModerationService(repo);

      const result = await service.decideAppeal({
        appealId: "74000000-0000-4000-8000-000000000002",
        decision: "overturned",
        reasonCode: "decision_overturned_evidence_valid",
        notes: "Independent review confirms the syllabus matches correctly.",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.newClaimStatus).toBe("under_review");
      }
    });
  });
});
