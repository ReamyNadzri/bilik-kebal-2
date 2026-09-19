import type { ClaimsOperationCode } from "@/contracts/claims";

export interface ClaimActor {
  emailVerified: boolean;
  institutionVerified: boolean;
  restricted: boolean;
}

export function claimEligibility(
  actor: ClaimActor | null,
  wantedStatus: "open" | "reviewing" | "expired" | "missing",
): Extract<
  ClaimsOperationCode,
  | "AUTH_REQUIRED"
  | "EMAIL_NOT_VERIFIED"
  | "INSTITUTION_VERIFICATION_REQUIRED"
  | "ACCOUNT_RESTRICTED"
  | "WANTED_NOT_FOUND"
  | "WANTED_NOT_OPEN"
> | null {
  if (!actor) return "AUTH_REQUIRED";
  if (!actor.emailVerified) return "EMAIL_NOT_VERIFIED";
  if (!actor.institutionVerified) return "INSTITUTION_VERIFICATION_REQUIRED";
  if (actor.restricted) return "ACCOUNT_RESTRICTED";
  if (wantedStatus === "missing") return "WANTED_NOT_FOUND";
  if (wantedStatus !== "open") return "WANTED_NOT_OPEN";
  return null;
}
