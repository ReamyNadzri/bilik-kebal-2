import type { Metadata } from "next";
import { FixtureNotice } from "@/components/fixture-notice";
import { VerificationStatus } from "@/components/verification-status";
import { EMAIL_VERIFIED_ONLY } from "@/features/presentation/fixtures/account";

export const metadata: Metadata = {
  title: "Profile | VAULTIX",
};

/**
 * Fixture-only screen.
 *
 * Remove FixtureNotice and the fixture import in the same slice that connects
 * this page to the Codex-owned identity operations.
 */
export default function ProfilePage() {
  const account = EMAIL_VERIFIED_ONLY;

  return (
    <>
      <h1>Profile</h1>

      <FixtureNotice screen="Profile verification status" />

      <VerificationStatus
        email={account.email}
        institution={account.institution}
        capabilities={account.capabilities}
      />
    </>
  );
}
