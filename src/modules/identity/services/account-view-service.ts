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
  emailConfirmedAt: string | null;
  institution: { id: string; name: string } | null;
  institutionVerificationState: IdentityTrust["institution"];
  latestVerificationRequest: AccountViewModel["latestVerificationRequest"];
  hasActiveRestriction: boolean;
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
    institution: record.institution,
    latestVerificationRequest: record.latestVerificationRequest,
    trust,
  };
}
