import {
  CLAIM_MAX_BYTES,
  claimSubmissionSchema,
  confirmClaimUploadSchema,
  type ClaimsOperationCode,
  type CompletedClaimProof,
  type CompleteClaimUploadResult,
  type CreateClaimUploadResult,
  type ValidatedClaimSubmissionInput,
} from "@/contracts/claims";
import { failure, success } from "@/contracts/operation-result";
import { claimEligibility, type ClaimActor } from "../domain/claim-policy";

export interface ClaimRepository {
  createClaim(input: {
    actor: ClaimActor & { userId: string; institutionId: string };
    submission: ValidatedClaimSubmissionInput;
    objectKey: string;
    expiresAt: string;
  }): Promise<{ claimId: string; objectKey: string }>;
  completeClaim(input: { actorUserId: string; claimId: string }): Promise<CompletedClaimProof>;
}

export interface ClaimUploadGateway {
  createSignedUpload(input: {
    objectKey: string;
    mimeType: ValidatedClaimSubmissionInput["mimeType"];
    maxBytes: number;
  }): Promise<{ signedUrl: string; token: string }>;
}

interface ClaimUploadConfig {
  uploadsEnabled: boolean;
  now: () => Date;
  generateId: () => string;
  repository: ClaimRepository;
  gateway: ClaimUploadGateway;
}

function validationFailure(input: unknown): CreateClaimUploadResult | null {
  const parsed = claimSubmissionSchema.safeParse(input);
  if (parsed.success) return null;
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    const field = String(issue.path[0] ?? "form");
    fieldErrors[field] ??= [];
    fieldErrors[field].push(issue.message);
  }
  const code: ClaimsOperationCode = fieldErrors.mimeType
    ? "UNSUPPORTED_FILE_TYPE"
    : fieldErrors.sizeBytes
      ? "FILE_TOO_LARGE"
      : "VALIDATION_ERROR";
  return failure(
    code,
    code === "VALIDATION_ERROR" ? "Check the claim details." : "Check the selected file.",
    fieldErrors,
  );
}

export class ClaimUploadService {
  constructor(private readonly config: ClaimUploadConfig) {}

  async create(
    actor: (ClaimActor & { userId: string; institutionId: string }) | null,
    wantedStatus: "open" | "reviewing" | "expired" | "missing",
    input: unknown,
  ): Promise<CreateClaimUploadResult> {
    const invalid = validationFailure(input);
    if (invalid) return invalid;
    const submission = claimSubmissionSchema.parse(input);
    const eligibility = claimEligibility(actor, wantedStatus);
    if (eligibility) return failure(eligibility, this.message(eligibility));
    if (!actor) return failure("AUTH_REQUIRED", "Sign in before submitting a claim.");
    if (!this.config.uploadsEnabled)
      return failure("UPLOAD_UNAVAILABLE", "Claim uploads are not enabled in this environment.");

    const now = this.config.now();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
    const objectKey = `${actor.userId}/${this.config.generateId()}/original`;
    try {
      const claim = await this.config.repository.createClaim({
        actor,
        submission,
        objectKey,
        expiresAt,
      });
      const upload = await this.config.gateway.createSignedUpload({
        objectKey: claim.objectKey,
        mimeType: submission.mimeType,
        maxBytes: CLAIM_MAX_BYTES,
      });
      return success({
        claimId: claim.claimId,
        objectPath: claim.objectKey,
        bucket: "quarantine",
        signedUrl: upload.signedUrl,
        token: upload.token,
        expiresAt,
        maxBytes: CLAIM_MAX_BYTES,
        mimeType: submission.mimeType,
      });
    } catch {
      return failure("UPLOAD_UNAVAILABLE", "Claim upload is temporarily unavailable. Try again.");
    }
  }

  async complete(
    actor: (ClaimActor & { userId: string; institutionId: string }) | null,
    input: unknown,
  ): Promise<CompleteClaimUploadResult> {
    const parsed = confirmClaimUploadSchema.safeParse(input);
    if (!parsed.success) {
      return failure("VALIDATION_ERROR", "Check the claim details.");
    }
    if (!actor) {
      return failure("AUTH_REQUIRED", "Sign in before confirming upload.");
    }
    if (actor.restricted) {
      return failure("ACCOUNT_RESTRICTED", "This account cannot submit claims right now.");
    }
    try {
      const proof = await this.config.repository.completeClaim({
        actorUserId: actor.userId,
        claimId: parsed.data.claimId,
      });
      return success(proof);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("claim not found") || msg.includes("upload session not found")) {
        return failure("CLAIM_NOT_FOUND", "Claim not found.");
      }
      if (msg.includes("forbidden")) {
        return failure("ACCOUNT_RESTRICTED", "Not authorized to update this claim.");
      }
      if (msg.includes("upload session expired")) {
        return failure("CLAIM_NOT_EDITABLE", "Upload session has expired.");
      }
      return failure("CLAIMS_UNAVAILABLE", "Claim completion is temporarily unavailable.");
    }
  }

  private message(code: Exclude<ClaimsOperationCode, "VALIDATION_ERROR">) {
    switch (code) {
      case "AUTH_REQUIRED":
        return "Sign in before submitting a claim.";
      case "EMAIL_NOT_VERIFIED":
        return "Verify your email before submitting a claim.";
      case "INSTITUTION_VERIFICATION_REQUIRED":
        return "Institution verification is required to submit a claim.";
      case "ACCOUNT_RESTRICTED":
        return "This account cannot submit claims right now.";
      case "WANTED_NOT_FOUND":
        return "Wanted request not found.";
      case "WANTED_NOT_OPEN":
        return "This Wanted is no longer accepting claims.";
      default:
        return "Claim upload is unavailable.";
    }
  }
}
