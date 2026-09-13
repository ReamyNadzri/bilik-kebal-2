"use client";

import Link from "next/link";
import { useState } from "react";
import { TrustBadge } from "./trust-badge";
import { UiStatus } from "./ui-status";

export type EmailVerificationStatus = "pending" | "verified" | "expired" | "invalid";

export interface EmailVerificationProps {
  status: EmailVerificationStatus;
  address: string;
}

/**
 * Email verification outcome presentation.
 *
 * Fixture-only: it sends nothing and verifies nothing. Verifying an email
 * proves control of an address. It does not grant the star emblem and does not
 * permit transacting — institution verification is a separate trust state
 * (context/project-overview.md). Saying so here stops the success screen from
 * implying an access it did not grant.
 */
export function EmailVerification({ status, address }: EmailVerificationProps) {
  const [resendAttempted, setResendAttempted] = useState(false);

  const canResend = status === "pending" || status === "expired";

  return (
    <section className="email-verification">
      {status === "pending" ? (
        <UiStatus
          kind="offline"
          heading="Check your email"
          message={`A verification link was sent to ${address}. Open it to confirm the address belongs to you.`}
        />
      ) : null}

      {status === "expired" ? (
        <UiStatus
          kind="expired"
          heading="That verification link has expired"
          message={`Request a new link for ${address}. The old one can no longer be used.`}
        />
      ) : null}

      {status === "invalid" ? (
        <UiStatus
          kind="error"
          heading="That verification link could not be used"
          message="It may have been altered, already used, or issued for a different account. Request a new one from the sign-in screen."
        />
      ) : null}

      {status === "verified" ? (
        <>
          <p>
            <TrustBadge kind="email" state="verified" />
          </p>

          <p>
            You can now sign in and browse the Wanted Board. Funding a bounty, submitting a claim
            and downloading a resource each additionally require institution verification, which a
            Sheriff grants separately.
          </p>

          <p className="auth-form__links">
            <Link href="/sign-in">Sign in</Link>
            <Link href="/profile/institution-verification">Verify your institution</Link>
          </p>
        </>
      ) : null}

      {canResend ? (
        <>
          <button
            className="auth-form__submit"
            type="button"
            onClick={() => setResendAttempted(true)}
          >
            Resend the link
          </button>

          {resendAttempted ? (
            <UiStatus
              kind="error"
              heading="No email was sent"
              message="This screen is not connected to a verification operation yet, so no message was delivered."
            />
          ) : null}
        </>
      ) : null}
    </section>
  );
}
