import {
  claimAppealDecisionSchema,
  claimAppealInputSchema,
  claimReportInputSchema,
  isHighRiskReportCategory,
  type ClaimAppealDetails,
  type ClaimReportDetails,
  type DecideClaimAppealResult,
  type SubmitClaimAppealResult,
  type SubmitClaimReportResult,
} from "@/contracts/moderation";
import { failure, success } from "@/contracts/operation-result";

export interface ModerationRepository {
  submitReport(input: {
    claimId: string;
    category: string;
    description: string;
  }): Promise<{ reportId: string }>;

  submitAppeal(input: {
    claimId: string;
    reason: string;
  }): Promise<{ appealId: string; deadline: string }>;

  decideAppeal(input: {
    appealId: string;
    decision: string;
    reasonCode: string;
    notes: string | null;
  }): Promise<{ appealId: string; newClaimStatus: string }>;

  listReports(options?: { status?: string }): Promise<ClaimReportDetails[]>;
  listAppeals(options?: { status?: string }): Promise<ClaimAppealDetails[]>;
}

export class ClaimModerationService {
  constructor(private readonly repository: ModerationRepository) {}

  async submitReport(input: unknown): Promise<SubmitClaimReportResult> {
    const parsed = claimReportInputSchema.safeParse(input);
    if (!parsed.success) {
      return failure(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid report details.",
      );
    }

    try {
      const isHighRisk = isHighRiskReportCategory(parsed.data.category);
      const result = await this.repository.submitReport({
        claimId: parsed.data.claimId,
        category: parsed.data.category,
        description: parsed.data.description,
      });

      return success({
        reportId: result.reportId,
        isRestricted: isHighRisk,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("authentication required")) {
        return failure("AUTH_REQUIRED", "Authentication required to submit report.");
      }
      if (message.includes("claim not found")) {
        return failure("CLAIM_NOT_FOUND", "The target claim was not found.");
      }
      return failure("MODERATION_UNAVAILABLE", "Report could not be submitted. Please try again.");
    }
  }

  async submitAppeal(input: unknown): Promise<SubmitClaimAppealResult> {
    const parsed = claimAppealInputSchema.safeParse(input);
    if (!parsed.success) {
      return failure(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid appeal details.",
      );
    }

    try {
      const result = await this.repository.submitAppeal({
        claimId: parsed.data.claimId,
        reason: parsed.data.reason,
      });

      return success({
        appealId: result.appealId,
        deadline: result.deadline,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("authentication required")) {
        return failure("AUTH_REQUIRED", "Authentication required to submit appeal.");
      }
      if (message.includes("only claim owner")) {
        return failure("NOT_AUTHORIZED", "Only the hunter who submitted this claim can appeal.");
      }
      if (message.includes("only rejected or restricted")) {
        return failure("CLAIM_NOT_REJECTED", "Only rejected or restricted claims can be appealed.");
      }
      if (message.includes("appeal window has expired")) {
        return failure("APPEAL_EXPIRED", "The 7-day window to appeal this decision has lapsed.");
      }
      if (message.includes("already been submitted") || message.includes("23505")) {
        return failure("APPEAL_ALREADY_EXISTS", "An appeal has already been filed for this claim.");
      }
      return failure("MODERATION_UNAVAILABLE", "Appeal could not be submitted. Please try again.");
    }
  }

  async decideAppeal(input: unknown): Promise<DecideClaimAppealResult> {
    const parsed = claimAppealDecisionSchema.safeParse(input);
    if (!parsed.success) {
      return failure(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid decision details.",
      );
    }

    try {
      const result = await this.repository.decideAppeal({
        appealId: parsed.data.appealId,
        decision: parsed.data.decision,
        reasonCode: parsed.data.reasonCode,
        notes: parsed.data.notes ?? null,
      });

      return success(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("segregation of duties")) {
        return failure(
          "SEGREGATION_VIOLATION",
          "Segregation of duties: You issued the original decision on this claim and cannot review this appeal.",
        );
      }
      if (message.includes("appellant cannot review")) {
        return failure("CANNOT_REVIEW_OWN_APPEAL", "You cannot review your own appeal.");
      }
      if (message.includes("reviewer not authorized") || message.includes("42501")) {
        return failure("NOT_AUTHORIZED", "You are not authorized to decide this appeal.");
      }
      return failure("MODERATION_UNAVAILABLE", "Appeal decision could not be recorded.");
    }
  }

  async listReports(options?: { status?: string }): Promise<ClaimReportDetails[]> {
    return this.repository.listReports(options);
  }

  async listAppeals(options?: { status?: string }): Promise<ClaimAppealDetails[]> {
    return this.repository.listAppeals(options);
  }
}
