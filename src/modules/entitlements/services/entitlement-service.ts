import type { GetClaimDownloadResult } from "@/contracts/entitlements";
import { failure, success } from "@/contracts/operation-result";
import { evaluateClaimDownloadAccess } from "../domain/entitlement-policy";
import type { EntitlementRepository } from "../repositories/entitlement-repository";

export class EntitlementService {
  constructor(private readonly repository: EntitlementRepository) {}

  async getClaimDownloadUrl(userId: string, claimId: string): Promise<GetClaimDownloadResult> {
    const claim = await this.repository.getClaimDownloadMeta(claimId);
    if (!claim) {
      return failure("NOT_FOUND", "Claim not found.");
    }

    const isStaff = await this.repository.isStaff(userId, claim.institutionId);

    // Only staff and the uploading hunter may download quarantined files
    if (claim.bucket === "quarantine" && !isStaff && claim.hunterUserId !== userId) {
      return failure("RESTRICTED", "Resource is currently quarantined or undergoing screening.");
    }

    const entitlement = await this.repository.getEntitlement(userId, claim.wantedRequestId);

    const access = evaluateClaimDownloadAccess({
      userId,
      isStaff,
      claim: {
        id: claim.id,
        hunterUserId: claim.hunterUserId,
        isRestricted: claim.isRestricted,
        freeReleaseOptIn: claim.freeReleaseOptIn,
        rightsConfirmedAt: claim.rightsConfirmedAt,
        status: claim.status,
        bucket: claim.bucket,
      },
      entitlement: entitlement
        ? {
            id: entitlement.id,
            isRevoked: entitlement.isRevoked,
            revocationReason: entitlement.revocationReason,
          }
        : null,
    });

    if (!access.allowed) {
      return failure(access.code, access.reason ?? "Access to download this resource was denied.");
    }

    try {
      const expiresInSeconds = 900; // 15 minutes
      const downloadUrl = await this.repository.createSignedDownloadUrl(
        claim.bucket,
        claim.objectKey,
        claim.fileName,
        expiresInSeconds,
      );

      return success({
        downloadUrl,
        fileName: claim.fileName,
        sizeBytes: claim.sizeBytes,
        mimeType: claim.mimeType,
        expiresInSeconds,
      });
    } catch {
      return failure("STORAGE_ERROR", "Unable to generate download URL at this time.");
    }
  }

  async revokeEntitlements(wantedRequestId: string, reason: string): Promise<number> {
    return this.repository.revokeEntitlementsForWanted(wantedRequestId, reason);
  }
}
