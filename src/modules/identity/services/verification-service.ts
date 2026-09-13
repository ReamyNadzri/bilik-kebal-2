import { z } from "zod";

import type {
  AutomaticVerificationResult,
  ManualVerificationRequestResult,
  RestrictionResult,
  ReviewVerificationResult,
  VerificationOperationCode,
} from "@/contracts/identity";
import { failure, success } from "@/contracts/operation-result";

const uuidSchema = z.string().uuid();
const reasonCodeSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/)
  .max(100);
const emailSchema = z.string().trim().toLowerCase().email().max(254);
const evidencePathSchema = z
  .string()
  .min(3)
  .max(512)
  .refine((path) => {
    return !path.startsWith("/") && !path.includes("..");
  }, "Evidence path is invalid");

const manualRequestSchema = z.object({
  emailVerified: z.boolean(),
  evidenceObjectPath: evidencePathSchema,
  institutionId: uuidSchema,
  userId: uuidSchema,
});

const reviewSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  institutionId: uuidSchema,
  reasonCode: reasonCodeSchema,
  requestId: z.string().min(1).max(100),
});

const restrictionSchema = z.object({
  reasonCode: reasonCodeSchema,
  userId: uuidSchema,
});

type VerificationFailure = {
  ok: false;
  code: VerificationOperationCode;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type PlatformRole = "owner" | "platform_sheriff";

export interface VerificationActor {
  authenticatedAt: string;
  institutionSheriffFor: string[];
  platformRole: PlatformRole | null;
  userId: string;
}

export interface VerificationRepository {
  verifyMembershipByEmailDomain(
    domain: string,
  ): Promise<{ institutionId: string; status: "verified" } | { status: "not_approved" }>;
  createManualRequest(input: {
    evidenceDeleteAfter: string;
    evidenceObjectPath: string;
    institutionId: string;
    userId: string;
  }): Promise<{ requestId: string }>;
  reviewManualRequest(input: {
    actorUserId: string;
    decision: "approved" | "rejected";
    institutionId: string;
    reasonCode: string;
    requestId: string;
    reviewedAt: string;
  }): Promise<{ status: "conflict" | "not_found" | "updated" }>;
  restrictAccount(input: {
    actorUserId: string;
    reasonCode: string;
    userId: string;
  }): Promise<{ status: "already_active" | "created" }>;
}

function validationFailure(error: z.ZodError): VerificationFailure {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    fieldErrors[field] ??= [];
    fieldErrors[field].push(issue.message);
  }

  return failure("VALIDATION_ERROR", "Check the highlighted fields.", fieldErrors);
}

export class VerificationService {
  private static readonly RECENT_AUTH_WINDOW_MS = 15 * 60 * 1000;
  private static readonly EVIDENCE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

  constructor(
    private readonly repository: VerificationRepository,
    private readonly now: () => Date,
  ) {}

  async verifyByEmailDomain(input: {
    email: string;
    emailVerified: boolean;
    userId: string;
  }): Promise<AutomaticVerificationResult> {
    const parsed = z
      .object({ email: emailSchema, emailVerified: z.boolean(), userId: uuidSchema })
      .safeParse(input);

    if (!parsed.success) {
      return validationFailure(parsed.error);
    }

    if (!parsed.data.emailVerified) {
      return failure("EMAIL_NOT_VERIFIED", "Verify your email before verifying an institution.");
    }

    const domain = parsed.data.email.split("@")[1];
    if (!domain) {
      return failure("VALIDATION_ERROR", "Check the highlighted fields.", {
        email: ["Email address is invalid"],
      });
    }

    const verification = await this.repository.verifyMembershipByEmailDomain(domain);
    if (verification.status === "not_approved") {
      return failure(
        "DOMAIN_NOT_APPROVED",
        "This email domain is not approved for automatic verification. Use manual review.",
      );
    }

    return success({ institutionId: verification.institutionId, status: "verified" as const });
  }

  async requestManualVerification(input: unknown): Promise<ManualVerificationRequestResult> {
    const parsed = manualRequestSchema.safeParse(input);
    if (!parsed.success) {
      return validationFailure(parsed.error);
    }

    if (!parsed.data.emailVerified) {
      return failure("EMAIL_NOT_VERIFIED", "Verify your email before requesting manual review.");
    }

    if (parsed.data.evidenceObjectPath.split("/")[0] !== parsed.data.userId) {
      return failure("NOT_AUTHORIZED", "The evidence path does not belong to this account.");
    }

    const evidenceDeleteAfter = new Date(
      this.now().getTime() + VerificationService.EVIDENCE_RETENTION_MS,
    ).toISOString();
    const request = await this.repository.createManualRequest({
      evidenceDeleteAfter,
      evidenceObjectPath: parsed.data.evidenceObjectPath,
      institutionId: parsed.data.institutionId,
      userId: parsed.data.userId,
    });

    return success({
      evidenceDeleteAfter,
      requestId: request.requestId,
      status: "pending" as const,
    });
  }

  async reviewManualVerification(
    input: unknown,
    actor: VerificationActor,
  ): Promise<ReviewVerificationResult> {
    const parsed = reviewSchema.safeParse(input);
    if (!parsed.success) {
      return validationFailure(parsed.error);
    }

    if (!this.canReviewInstitution(actor, parsed.data.institutionId)) {
      return failure("NOT_AUTHORIZED", "You are not authorised to review this institution.");
    }

    if (!this.isRecentlyAuthenticated(actor)) {
      return failure("RECENT_AUTH_REQUIRED", "Sign in again before completing this review.");
    }

    const reviewedAt = this.now().toISOString();
    const result = await this.repository.reviewManualRequest({
      actorUserId: actor.userId,
      ...parsed.data,
      reviewedAt,
    });

    if (result.status === "not_found") {
      return failure("REQUEST_NOT_FOUND", "The verification request was not found.");
    }

    if (result.status === "conflict") {
      return failure("VERIFICATION_CONFLICT", "The verification request was already decided.");
    }

    return success({ status: parsed.data.decision });
  }

  async restrictAccount(input: unknown, actor: VerificationActor): Promise<RestrictionResult> {
    const parsed = restrictionSchema.safeParse(input);
    if (!parsed.success) {
      return validationFailure(parsed.error);
    }

    if (!actor.platformRole) {
      return failure("NOT_AUTHORIZED", "You are not authorised to restrict accounts.");
    }

    if (!this.isRecentlyAuthenticated(actor)) {
      return failure("RECENT_AUTH_REQUIRED", "Sign in again before restricting this account.");
    }

    await this.repository.restrictAccount({
      actorUserId: actor.userId,
      ...parsed.data,
    });
    return success({ status: "restricted" as const });
  }

  private canReviewInstitution(actor: VerificationActor, institutionId: string): boolean {
    return actor.platformRole !== null || actor.institutionSheriffFor.includes(institutionId);
  }

  private isRecentlyAuthenticated(actor: VerificationActor): boolean {
    const authenticatedAt = new Date(actor.authenticatedAt).getTime();
    const age = this.now().getTime() - authenticatedAt;
    return Number.isFinite(age) && age >= 0 && age <= VerificationService.RECENT_AUTH_WINDOW_MS;
  }
}
