import { z } from "zod";
import type { OperationResult } from "./operation-result";

export const CLAIM_MAX_BYTES = 50 * 1024 * 1024;
export const claimMimeTypes = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type ClaimMimeType = (typeof claimMimeTypes)[number];
export type ClaimLifecycle =
  | "uploading"
  | "screening"
  | "needs_information"
  | "under_review"
  | "approved"
  | "not_selected"
  | "rejected"
  | "withdrawn";

export type ClaimsOperationCode =
  | "AUTH_REQUIRED"
  | "EMAIL_NOT_VERIFIED"
  | "INSTITUTION_VERIFICATION_REQUIRED"
  | "ACCOUNT_RESTRICTED"
  | "WANTED_NOT_FOUND"
  | "WANTED_NOT_OPEN"
  | "VALIDATION_ERROR"
  | "UNSUPPORTED_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "UPLOAD_UNAVAILABLE"
  | "CLAIM_NOT_FOUND"
  | "CLAIM_NOT_EDITABLE"
  | "CLAIMS_UNAVAILABLE";

const uuid = z.uuid();

export const claimSubmissionSchema = z.object({
  wantedId: uuid,
  fileName: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .refine((value) => !/[\\/\0]/.test(value), "Filename is invalid."),
  mimeType: z.enum(claimMimeTypes),
  sizeBytes: z.number().int().positive().max(CLAIM_MAX_BYTES),
  sha256: z.string().regex(/^[a-f0-9]{64}$/, "Checksum must be a SHA-256 hex digest."),
  rightsConfirmed: z.literal(true),
  freeReleaseOptIn: z.boolean(),
});

export type ClaimSubmissionInput = z.input<typeof claimSubmissionSchema>;
export type ValidatedClaimSubmissionInput = z.output<typeof claimSubmissionSchema>;

export interface ClaimUploadSession {
  claimId: string;
  objectPath: string;
  bucket: "quarantine";
  signedUrl: string;
  token: string;
  expiresAt: string;
  maxBytes: number;
  mimeType: ClaimMimeType;
}

export type CreateClaimUploadResult = OperationResult<ClaimUploadSession, ClaimsOperationCode>;

export const confirmClaimUploadSchema = z.object({
  claimId: uuid,
});

export type ConfirmClaimUploadInput = z.infer<typeof confirmClaimUploadSchema>;

export interface CompletedClaimProof {
  claimId: string;
  wantedId: string;
  status: ClaimLifecycle;
  fileName: string;
  sizeBytes: number;
  mimeType: ClaimMimeType;
  completedAt: string;
}

export type CompleteClaimUploadResult = OperationResult<CompletedClaimProof, ClaimsOperationCode>;
