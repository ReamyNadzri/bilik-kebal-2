import type { EmailBadgeState, InstitutionBadgeState } from "@/components/trust-badge";
import type { AccountCapabilities } from "../account-capabilities";

/**
 * Development fixture for screens whose backend operation does not exist yet.
 *
 * Never imported by a screen that has been connected to a real operation, and
 * never used to stand in for a policy decision. Delete a fixture in the same
 * slice that wires its screen to the Codex-owned identity operations.
 */
export interface AccountFixture {
  email: EmailBadgeState;
  institution: InstitutionBadgeState;
  capabilities: AccountCapabilities;
}

/**
 * The instructive case: email is verified, so the account may browse, but
 * institution verification is missing, so it may not transact, claim or
 * download.
 */
export const EMAIL_VERIFIED_ONLY: AccountFixture = {
  email: "verified",
  institution: "unverified",
  capabilities: {
    browseMetadata: true,
    transact: false,
    submitClaim: false,
    download: false,
  },
};
