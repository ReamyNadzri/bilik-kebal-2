import { z } from "zod";
import type { OperationResult } from "./operation-result";

export interface EntitlementRecord {
  id: string;
  wantedRequestId: string;
  claimId: string;
  userId: string;
  grantedAt: string;
  isRevoked: boolean;
  revokedAt: string | null;
  revocationReason: string | null;
}

export interface ClaimDownloadUrlView {
  downloadUrl: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  expiresInSeconds: number;
}

export type EntitlementOperationCode =
  | "SUCCESS"
  | "NOT_FOUND"
  | "AUTH_REQUIRED"
  | "NOT_ENTITLED"
  | "RESTRICTED"
  | "REVOKED"
  | "STORAGE_ERROR";

export type GetClaimDownloadResult = OperationResult<
  ClaimDownloadUrlView,
  EntitlementOperationCode
>;

export const revokeEntitlementsInputSchema = z.object({
  wantedRequestId: z.string().uuid(),
  reason: z.string().trim().min(5, "Revocation reason must be at least 5 characters.").max(500),
});

export type RevokeEntitlementsInput = z.infer<typeof revokeEntitlementsInputSchema>;
