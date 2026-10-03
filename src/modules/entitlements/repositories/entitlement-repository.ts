import type { EntitlementRecord } from "@/contracts/entitlements";
import type {
  ClaimFileLocation,
  SignOutcome,
} from "@/modules/claims/storage/promote-approved-claim-file";

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
  /** Signs with the service role; call only after access was allowed. */
  signClaimDownload(
    file: ClaimFileLocation,
    fileName: string,
    expiresInSeconds: number,
  ): Promise<SignOutcome>;
  revokeEntitlementsForWanted(wantedRequestId: string, reason: string): Promise<number>;
}
