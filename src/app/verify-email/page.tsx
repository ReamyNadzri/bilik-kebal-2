import type { Metadata } from "next";
import { EmailVerification, type EmailVerificationStatus } from "@/components/email-verification";
import { readPendingVerificationEmail } from "@/modules/identity/delivery/pending-verification";

export const metadata: Metadata = {
  title: "Verify your email | VAULTIX",
};

/**
 * Reads a per-browser cookie, so it is rendered per request and never enters a
 * shared cache (context/code-standards.md).
 */
export const dynamic = "force-dynamic";

const STATUSES: readonly EmailVerificationStatus[] = ["pending", "verified", "expired", "invalid"];

/**
 * The query string is supplied by whoever followed the link, so it is treated
 * as untrusted input. Anything unrecognised — absent, empty, repeated, or
 * invented — falls back to waiting.
 *
 * It must never fall back to `verified`: a screen that says "Email Verified"
 * because someone typed `?status=verified` teaches people to trust a claim the
 * server never made.
 */
function readStatus(value: string | string[] | undefined): EmailVerificationStatus {
  const candidate = Array.isArray(value) ? value[0] : value;

  return STATUSES.find((status) => status === candidate) ?? "pending";
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const status = readStatus((await searchParams).status);

  /**
   * The address comes from the signed, HTTP-only pending-verification cookie
   * that sign-up and an unverified sign-in set — the same source the resend
   * operation reads. The browser cannot choose the recipient, here or there.
   * A failure to read it is not worth interrupting the page for: the screen
   * simply omits the address and withholds the resend.
   */
  const address = await readPendingVerificationEmail().catch(() => null);

  return (
    <>
      <h1>Verify your email</h1>

      <EmailVerification status={status} address={address} />
    </>
  );
}
