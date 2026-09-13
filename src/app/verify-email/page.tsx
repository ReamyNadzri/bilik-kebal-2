import type { Metadata } from "next";
import { EmailVerification, type EmailVerificationStatus } from "@/components/email-verification";
import { FixtureNotice } from "@/components/fixture-notice";
import { PENDING_VERIFICATION_ADDRESS } from "@/features/presentation/fixtures/account";

export const metadata: Metadata = {
  title: "Verify your email | VAULTIX",
};

const STATUSES: readonly EmailVerificationStatus[] = ["pending", "verified", "expired", "invalid"];

function readStatus(value: string | string[] | undefined): EmailVerificationStatus {
  const candidate = Array.isArray(value) ? value[0] : value;

  return STATUSES.find((status) => status === candidate) ?? "pending";
}

/**
 * Fixture-only. The real flow lands here from the emailed link with the
 * outcome in the query string, which is why the status is read from there
 * rather than held in component state. Remove FixtureNotice when the
 * verification operation lands.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const status = readStatus((await searchParams).status);

  return (
    <>
      <h1>Verify your email</h1>

      <FixtureNotice screen="Email verification" />

      <EmailVerification status={status} address={PENDING_VERIFICATION_ADDRESS} />
    </>
  );
}
