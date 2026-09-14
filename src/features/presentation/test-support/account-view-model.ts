import type { AccountViewModel } from "@/contracts";

/**
 * Builder for the Codex-published `AccountViewModel`.
 *
 * Test support only. Production code must never import this module.
 *
 * Deliberately builds the *published contract type* rather than a local shape,
 * so a change Codex makes to the contract breaks these tests at compile time
 * instead of letting the UI drift away from the operation that feeds it.
 *
 * The default is the instructive case: email verified, institution not, so the
 * account may browse but not transact, claim or download.
 */
export function anAccountViewModel(overrides: Partial<AccountViewModel> = {}): AccountViewModel {
  return {
    displayName: "Synthetic Tester",
    trust: { email: "verified", institution: "unverified", restricted: false },
    capabilities: {
      browseMetadata: true,
      transact: false,
      submitClaim: false,
      download: false,
    },
    institution: null,
    latestVerificationRequest: null,
    console: { hasAccess: false },
    ...overrides,
  };
}
