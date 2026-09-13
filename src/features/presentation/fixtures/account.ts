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

/**
 * Approved institution email domains.
 *
 * Deliberately empty. "Confirm official UiTM email domains" is still an open
 * question in context/progress-tracker.md, and the frontend must not present a
 * guessed domain as an approved one. Populate this only from the reviewed
 * configuration once that question is closed.
 */
export const APPROVED_INSTITUTION_DOMAINS: readonly string[] = [];

/**
 * The signed-in viewer for fixture screens.
 *
 * A plain student: email verified, no institution verification, no console
 * role. Console access is a backend decision surfaced through the view model;
 * the frontend only renders it.
 */
export const VIEWER = {
  hasConsoleAccess: false,
} as const;

/**
 * Address shown on the fixture verification screen. Deliberately an example
 * domain: the approved institution domains are still an open question, and a
 * realistic-looking one could be mistaken for a confirmed value.
 */
export const PENDING_VERIFICATION_ADDRESS = "student@example.edu.my";
