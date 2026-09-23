import type { EntitlementRecord } from "@/contracts/entitlements";

export interface ClaimDownloadMeta {
  id: string;
  wantedRequestId: string;
  hunterUserId: string;
  institutionId: string;
  isRestricted: boolean;
  freeReleaseOptIn: boolean;
  rightsConfirmedAt: string | null;
  status: string;
  bucket: string;
  objectKey: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
}

export interface EntitlementRepository {
  getClaimDownloadMeta(claimId: string): Promise<ClaimDownloadMeta | null>;
  getEntitlement(userId: string, wantedRequestId: string): Promise<EntitlementRecord | null>;
  isStaff(userId: string, institutionId?: string): Promise<boolean>;
  createSignedDownloadUrl(
    bucket: string,
    objectKey: string,
    fileName: string,
    expiresInSeconds: number,
  ): Promise<string>;
  revokeEntitlementsForWanted(wantedRequestId: string, reason: string): Promise<number>;
}
