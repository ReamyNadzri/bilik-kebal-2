import type { Metadata } from "next";
import { FixtureNotice } from "@/components/fixture-notice";
import { InstitutionVerification } from "@/components/institution-verification";
import {
  EMAIL_VERIFIED_ONLY,
  APPROVED_INSTITUTION_DOMAINS,
} from "@/features/presentation/fixtures/account";

export const metadata: Metadata = {
  title: "Institution verification | VAULTIX",
};

/**
 * Fixture-only. Remove FixtureNotice and the fixture import in the same slice
 * that connects this page to the Codex-owned verification operation and a
 * private signed upload.
 */
export default function InstitutionVerificationPage() {
  return (
    <>
      <h1>Institution verification</h1>

      <FixtureNotice screen="Institution verification" />

      <InstitutionVerification
        state={EMAIL_VERIFIED_ONLY.institution}
        approvedDomains={APPROVED_INSTITUTION_DOMAINS}
      />
    </>
  );
}
