import type { EntitlementOperationCode } from "@/contracts/entitlements";

export interface CanDownloadClaimInput {
  userId: string;
  isStaff: boolean;
  claim: {
    id: string;
    hunterUserId: string;
    isRestricted: boolean;
    freeReleaseOptIn: boolean;
    rightsConfirmedAt: string | null;
    status: string;
    bucket: string;
  };
  entitlement: {
    id: string;
    isRevoked: boolean;
    revocationReason: string | null;
  } | null;
}

export interface CanDownloadClaimResult {
  allowed: boolean;
  code: EntitlementOperationCode;
  reason?: string;
}

export function evaluateClaimDownloadAccess(input: CanDownloadClaimInput): CanDownloadClaimResult {
  const { userId, isStaff, claim, entitlement } = input;

  // 1. If claim is restricted, no downloads are permitted except for staff evidence review
  if (claim.isRestricted && !isStaff) {
    return {
      allowed: false,
      code: "RESTRICTED",
      reason: "Claim has been restricted by moderation.",
    };
  }

  // 2. Staff have access for review and moderation
  if (isStaff) {
    return { allowed: true, code: "SUCCESS" };
  }

  // 3. Hunter can download their own uploaded file
  if (claim.hunterUserId === userId) {
    return { allowed: true, code: "SUCCESS" };
  }

  // 4. If user has an entitlement, check revocation status
  if (entitlement) {
    if (entitlement.isRevoked) {
      return {
        allowed: false,
        code: "REVOKED",
        reason: entitlement.revocationReason ?? "Entitlement has been revoked.",
      };
    }
    return { allowed: true, code: "SUCCESS" };
  }

  // 5. Check if claim was made free release (requires hunter opt-in AND confirmed rights)
  if (claim.freeReleaseOptIn && claim.rightsConfirmedAt !== null) {
    return { allowed: true, code: "SUCCESS" };
  }

  // 6. Otherwise user is not entitled
  return {
    allowed: false,
    code: "NOT_ENTITLED",
    reason: "A contribution to this bounty is required to access the resource.",
  };
}
