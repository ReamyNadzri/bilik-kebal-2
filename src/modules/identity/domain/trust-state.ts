export type EmailVerificationState = "unverified" | "verified";

export type InstitutionVerificationState = "unverified" | "pending" | "verified" | "rejected";

export interface IdentityTrust {
  email: EmailVerificationState;
  institution: InstitutionVerificationState;
  restricted: boolean;
}
