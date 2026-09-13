import type { VerificationOperationCode } from "@/contracts";

/**
 * Plain-English copy for each identity failure code.
 *
 * The backend supplies a safe message with every failure; these are the
 * fallbacks used when a screen needs wording of its own, and they keep money,
 * policy and security language clear rather than themed
 * (context/ui-context.md).
 */
export const IDENTITY_MESSAGE: Record<VerificationOperationCode, string> = {
  AUTH_RATE_LIMITED: "Too many attempts. Wait a few minutes before trying again.",
  AUTH_REQUIRED: "Sign in to continue.",
  AUTH_UNAVAILABLE: "Accounts are unavailable right now. Try again shortly.",
  EMAIL_NOT_VERIFIED: "Confirm your email address before signing in.",
  INVALID_CREDENTIALS: "That email address and password do not match an account.",
  REGISTRATION_FAILED: "The account could not be created. Try again shortly.",
  VALIDATION_ERROR: "Check the highlighted fields and try again.",
  DOMAIN_NOT_APPROVED:
    "That email domain is not on the approved list, so a Sheriff must review your evidence.",
  EVIDENCE_UPLOAD_UNAVAILABLE: "Evidence uploads are unavailable right now. Try again shortly.",
  NOT_AUTHORIZED: "Your account does not have permission for that action.",
  RECENT_AUTH_REQUIRED: "Sign in again to confirm it is you before continuing.",
  REQUEST_NOT_FOUND: "That verification request no longer exists.",
  UNSUPPORTED_EVIDENCE_TYPE: "That file type is not accepted. Use a PDF, JPEG or PNG.",
  VERIFICATION_CONFLICT: "A verification request for this account is already in progress.",
};

/**
 * Codes that mean the account exists but is blocked from this action, rather
 * than that the submission was wrong. Screens present these as a restriction,
 * not as a field error.
 */
export const RESTRICTION_CODES: readonly VerificationOperationCode[] = [
  "AUTH_REQUIRED",
  "EMAIL_NOT_VERIFIED",
  "NOT_AUTHORIZED",
  "RECENT_AUTH_REQUIRED",
];
