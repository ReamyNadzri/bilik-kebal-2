import type { OperationResult } from "./operation-result";

export type IdentityOperationCode =
  | "AUTH_RATE_LIMITED"
  | "AUTH_REQUIRED"
  | "AUTH_UNAVAILABLE"
  | "EMAIL_NOT_VERIFIED"
  | "INVALID_CREDENTIALS"
  | "REGISTRATION_FAILED"
  | "VALIDATION_ERROR";

export type VerificationOperationCode =
  | IdentityOperationCode
  | "DOMAIN_NOT_APPROVED"
  | "EVIDENCE_UPLOAD_UNAVAILABLE"
  | "NOT_AUTHORIZED"
  | "RECENT_AUTH_REQUIRED"
  | "REQUEST_NOT_FOUND"
  | "UNSUPPORTED_EVIDENCE_TYPE"
  | "VERIFICATION_CONFLICT";

export type RegistrationResult = OperationResult<{ next: "verify_email" }, IdentityOperationCode>;

export type SignInResult = OperationResult<{ next: "profile" }, IdentityOperationCode>;

export type PasswordRecoveryResult = OperationResult<{ accepted: true }, IdentityOperationCode>;

export type SignOutResult = OperationResult<{ signedOut: true }, "AUTH_UNAVAILABLE">;

export type AutomaticVerificationResult = OperationResult<
  { institutionId: string; status: "verified" },
  VerificationOperationCode
>;

export type ManualVerificationRequestResult = OperationResult<
  { evidenceDeleteAfter: string; requestId: string; status: "pending" },
  VerificationOperationCode
>;

export type EvidenceUploadResult = OperationResult<
  { objectPath: string; signedUrl: string; token: string },
  VerificationOperationCode
>;

export type ReviewVerificationResult = OperationResult<
  { status: "approved" | "rejected" },
  VerificationOperationCode
>;

export type RestrictionResult = OperationResult<
  { status: "restricted" },
  VerificationOperationCode
>;
