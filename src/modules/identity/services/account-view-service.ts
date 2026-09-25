import type { AccountViewModel } from "@/contracts/identity";
import {
  canBrowseMetadata,
  canDownload,
  canSubmitClaim,
  canTransact,
} from "../domain/access-policy";
import type { IdentityTrust } from "../domain/trust-state";

export interface AccountRecord {
  displayName: string;
  publicId?: string | null;
  avatarUrl?: string | null;
  joinedAt?: string | null;
  avatarPreset?: number | null;
  email?: string | null;
  emailConfirmedAt: string | null;
  institution: { id: string; name: string } | null;
  institutionVerificationState: IdentityTrust["institution"];
  latestVerificationRequest: AccountViewModel["latestVerificationRequest"];
  hasActiveRestriction: boolean;
  /** When a timeout ends; null for a permanent restriction or none. */
  restrictionExpiresAt?: string | null;
  hasConsoleAccess: boolean;
}

export function toAccountViewModel(record: AccountRecord): AccountViewModel {
  const trust: IdentityTrust = {
    email: record.emailConfirmedAt ? "verified" : "unverified",
    institution: record.institutionVerificationState,
    restricted: record.hasActiveRestriction,
  };

  return {
    capabilities: {
      browseMetadata: canBrowseMetadata(trust),
      transact: canTransact(trust),
      submitClaim: canSubmitClaim(trust),
      download: canDownload(trust),
    },
    console: { hasAccess: record.hasConsoleAccess },
    displayName: record.displayName,
    publicId: record.publicId ?? null,
    avatarUrl: record.avatarUrl ?? null,
    joinedAt: record.joinedAt ?? null,
    ...(record.avatarPreset !== undefined ? { avatarPreset: record.avatarPreset } : {}),
    ...(record.email !== undefined ? { email: record.email } : {}),
    institution: record.institution,
    latestVerificationRequest: record.latestVerificationRequest,
    trust,
    ...(record.hasActiveRestriction && record.restrictionExpiresAt
      ? { restrictedUntil: record.restrictionExpiresAt }
      : {}),
  };
}
