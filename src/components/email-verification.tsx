"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { TrustBadge } from "./trust-badge";
import { UiStatus } from "./ui-status";
import type { IdentityOperationCode, ResendVerificationResult } from "@/contracts";
import { callOperation } from "@/features/presentation/call-operation";
import { IDENTITY_MESSAGE } from "@/features/presentation/identity-messages";

export type EmailVerificationStatus = "pending" | "verified" | "expired" | "invalid";

export interface EmailVerificationProps {
  status: EmailVerificationStatus;
  /**
   * The address awaiting confirmation, read server-side from the signed,
   * HTTP-only pending-verification cookie. `null` when this browser holds no
   * pending sign-up, in which case the resend operation has no recipient and
   * is not offered.
   */
  address: string | null;
}

type Resend =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "failed"; code: IdentityOperationCode; message: string };

/**
 * Email verification outcome, and the resend operation.
 *
 * Verifying an email proves control of an address. It does not grant the star
 * emblem and does not permit transacting — institution verification is a
 * separate trust state (context/project-overview.md). Saying so on the success
 * path stops it from implying an access it did not grant.
 *
 * The outcome arrives in the query string because the flow lands here from an
 * emailed link; the page resolves it and an unrecognised value falls back to
 * waiting, never to success.
 */
export function EmailVerification({ status, address }: EmailVerificationProps) {
  const [resend, setResend] = useState<Resend>({ kind: "idle" });
  const [announcement, setAnnouncement] = useState("");
  /**
   * aria-disabled is advisory: it stops neither a click nor an Enter key, and
   * repeat activations can arrive in one tick before React re-renders. The
   * handler refuses the repeat itself.
   */
  const busyRef = useRef(false);

  const canResend = (status === "pending" || status === "expired") && address !== null;
  const sending = resend.kind === "sending";

  async function handleResend() {
    if (busyRef.current) {
      return;
    }

    busyRef.current = true;
    setResend({ kind: "sending" });

    try {
      const result = (await callOperation<{ accepted: true }, IdentityOperationCode>(
        "/api/auth/resend-verification",
        {},
        "AUTH_UNAVAILABLE",
      )) as ResendVerificationResult;

      if (result.ok) {
        setResend({ kind: "sent" });
        // Deliberately not the sentence shown on screen: a live region that
        // repeats visible text is read twice.
        setAnnouncement("Verification link sent.");
        return;
      }

      setResend({
        kind: "failed",
        code: result.code,
        message: result.message === "" ? IDENTITY_MESSAGE[result.code] : result.message,
      });
    } finally {
      busyRef.current = false;
    }
  }

  return (
    <section className="email-verification">
      <p className="visually-hidden" data-testid="resend-announcer" aria-live="polite">
        {announcement}
      </p>

      {status === "pending" ? (
        <UiStatus
          kind="offline"
          heading="Check your email"
          message={
            address === null
              ? "Open the verification link that was emailed to you to confirm the address belongs to you."
              : `A verification link was sent to ${address}. Open it to confirm the address belongs to you.`
          }
        />
      ) : null}

      {status === "expired" ? (
        <UiStatus
          kind="expired"
          heading="That verification link has expired"
          message={
            address === null
              ? "The old link can no longer be used. Create your account again to receive a new one."
              : `Request a new link for ${address}. The old one can no longer be used.`
          }
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
            onClick={handleResend}
            aria-disabled={sending ? true : undefined}
          >
            Resend the link
          </button>

          {sending ? <UiStatus kind="loading" heading="Sending a new link" /> : null}

          {resend.kind === "sent" ? (
            <p className="email-verification__sent">
              If that address still needs a link, one is on its way. Check your inbox and your spam
              folder.
            </p>
          ) : null}

          {resend.kind === "failed" ? (
            <UiStatus
              kind={resend.code === "AUTH_UNAVAILABLE" ? "offline" : "error"}
              heading="No new link was sent"
              message={resend.message}
            />
          ) : null}
        </>
      ) : null}

      {(status === "pending" || status === "expired") && address === null ? (
        <p className="auth-form__links">
          <Link href="/sign-up">Create an account</Link>
          <Link href="/sign-in">Sign in</Link>
        </p>
      ) : null}
    </section>
  );
}
