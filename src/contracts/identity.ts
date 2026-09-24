import type { OperationResult } from "./operation-result";

export type IdentityOperationCode =
  | "AUTH_RATE_LIMITED"
  | "AUTH_REQUIRED"
  | "AUTH_UNAVAILABLE"
  | "EMAIL_NOT_VERIFIED"
  | "INVALID_CREDENTIALS"
  | "REGISTRATION_FAILED"
  | "RECOVERY_LINK_INVALID"
  | "VALIDATION_ERROR";

export type VerificationOperationCode =
  | IdentityOperationCode
  | "DOMAIN_NOT_APPROVED"
  | "EVIDENCE_EXPIRED"
  | "EVIDENCE_UPLOAD_UNAVAILABLE"
  | "NOT_AUTHORIZED"
  | "RECENT_AUTH_REQUIRED"
  | "REQUEST_NOT_FOUND"
  | "UNSUPPORTED_EVIDENCE_TYPE"
  | "VERIFICATION_CONFLICT";

export type RegistrationResult = OperationResult<{ next: "verify_email" }, IdentityOperationCode>;

export type SignInResult = OperationResult<{ next: "profile" }, IdentityOperationCode>;

export type PasswordRecoveryResult = OperationResult<{ accepted: true }, IdentityOperationCode>;
export type PasswordUpdateResult = OperationResult<{ updated: true }, IdentityOperationCode>;

export type ResendVerificationResult = OperationResult<{ accepted: true }, IdentityOperationCode>;

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

export interface AccountViewModel {
  displayName: string;
  /** Public profile address (`/u/[publicId]`); never the auth user id. */
  publicId: string | null;
  /** Public avatar image, or null for the drawn default. */
  avatarUrl: string | null;
  /** When the account was created: the "joined" date on a profile. */
  joinedAt: string | null;
  /** The drawn character chosen instead of a photo (0 to 11), if any. */
  avatarPreset?: number | null;
  /** The member's own sign-in address. Shown only to them, never publicly. */
  email?: string | null;
  trust: {
    email: "unverified" | "verified";
    institution: "unverified" | "pending" | "verified" | "rejected";
    restricted: boolean;
  };
  capabilities: {
    browseMetadata: boolean;
    transact: boolean;
    submitClaim: boolean;
    download: boolean;
  };
  institution: { id: string; name: string } | null;
  latestVerificationRequest: {
    requestId: string;
    state: "pending" | "approved" | "rejected";
    submittedAt: string;
    decidedAt: string | null;
    reasonCode: string | null;
    evidenceDeleteAfter: string;
  } | null;
  console: { hasAccess: boolean };
}

export type AccountViewResult = OperationResult<
  AccountViewModel,
  "AUTH_REQUIRED" | "AUTH_UNAVAILABLE"
>;

export interface InstitutionOption {
  id: string;
  name: string;
  slug: string;
}

export type InstitutionOptionsResult = OperationResult<
  InstitutionOption[],
  "AUTH_REQUIRED" | "AUTH_UNAVAILABLE" | "EMAIL_NOT_VERIFIED"
>;

export interface VerificationQueueItem {
  requestId: string;
  institutionId: string;
  institutionName: string;
  applicantDisplayName: string;
  state: "pending" | "approved" | "rejected";
  submittedAt: string;
  evidenceDeleteAfter: string;
}

export type VerificationQueueResult = OperationResult<
  VerificationQueueItem[],
  "AUTH_REQUIRED" | "AUTH_UNAVAILABLE" | "NOT_AUTHORIZED"
>;

export type EvidenceReadResult = OperationResult<
  { signedUrl: string; expiresAt: string },
  | "AUTH_REQUIRED"
  | "AUTH_UNAVAILABLE"
  | "EVIDENCE_EXPIRED"
  | "NOT_AUTHORIZED"
  | "RECENT_AUTH_REQUIRED"
  | "REQUEST_NOT_FOUND"
  | "VALIDATION_ERROR"
>;

export type ReviewVerificationResult = OperationResult<
  { status: "approved" | "rejected" },
  VerificationOperationCode
>;

export type RestrictionResult = OperationResult<
  { status: "restricted" },
  VerificationOperationCode
>;
