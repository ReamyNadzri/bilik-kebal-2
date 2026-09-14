import type { MarketplaceOperationCode } from "@/contracts/marketplace";

export interface WantedActor {
  userId: string;
  emailVerified: boolean;
  institutionId: string | null;
  institutionVerified: boolean;
  restricted: boolean;
}

export function canManageWantedDraft(
  actor: WantedActor | null,
): Extract<
  MarketplaceOperationCode,
  | "AUTH_REQUIRED"
  | "EMAIL_NOT_VERIFIED"
  | "INSTITUTION_VERIFICATION_REQUIRED"
  | "ACCOUNT_RESTRICTED"
> | null {
  if (actor === null) return "AUTH_REQUIRED";
  if (!actor.emailVerified) return "EMAIL_NOT_VERIFIED";
  if (!actor.institutionVerified || actor.institutionId === null) {
    return "INSTITUTION_VERIFICATION_REQUIRED";
  }
  if (actor.restricted) return "ACCOUNT_RESTRICTED";
  return null;
}
