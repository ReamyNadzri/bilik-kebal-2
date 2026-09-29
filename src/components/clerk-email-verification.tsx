"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useUser } from "@clerk/nextjs";
import { FormField } from "./form-field";
import { UiStatus } from "./ui-status";
import { EmailDeliveryHint } from "./email-delivery-hint";
import { clerkMessage, type ClerkErrorLike } from "@/features/presentation/auth/clerk-messages";
import { syncClerkAccount } from "@/features/presentation/auth/clerk-navigation";

/** Clerk resource methods throw `{ errors: [{ code, message, longMessage }] }`. */
function firstClerkError(error: unknown): ClerkErrorLike | null {
  const errors = (error as { errors?: ClerkErrorLike[] } | null)?.errors;
  return Array.isArray(errors) && errors[0] ? errors[0] : null;
}

/**
 * Verifies the signed-in member's email with a Clerk code.
 *
 * New accounts verify during sign-up; this is for an account that reached
 * VAULTIX unverified (an imported one). Once Clerk says the address is
 * verified, VAULTIX's copy is updated straight away and the page re-renders
 * with the new trust state.
 */
export function ClerkEmailVerification() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [step, setStep] = useState<"start" | "code" | "done">("start");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const synced = useRef(false);

  const address = user?.primaryEmailAddress ?? null;
  const verified = address?.verification?.status === "verified" || step === "done";

  // Already verified in Clerk but perhaps not yet in VAULTIX (webhook lag).
  useEffect(() => {
    if (!verified || synced.current) return;
    synced.current = true;
    void syncClerkAccount().then(() => router.refresh());
  }, [router, verified]);

  if (!isLoaded) return <UiStatus kind="loading" heading="Checking your account" />;

  if (!user || !address) {
    return (
      <UiStatus
        kind="restricted"
        heading="Sign in to verify your email"
        message="Email verification happens inside your account."
        action={<Link href="/sign-in?next=/verify-email">Sign in</Link>}
      />
    );
  }

  if (verified) {
    return (
      <UiStatus
        kind="empty"
        heading="Your email is verified"
        message={`${address.emailAddress} is confirmed. You can browse Wanted requests now.`}
        action={<Link href="/profile">Go to your profile</Link>}
      />
    );
  }

  async function send() {
    if (!address) return;
    setBusy(true);
    setError(null);
    try {
      await address.prepareVerification({ strategy: "email_code" });
      setStep("code");
    } catch (caught) {
      setError(clerkMessage(firstClerkError(caught)));
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!address) return;
    const code = String(new FormData(event.currentTarget).get("code") ?? "").trim();
    if (code === "") {
      setError("Enter the code from the email.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await address.attemptVerification({ code });
      if (result.verification?.status === "verified") {
        setStep("done");
        return;
      }
      setError("That code could not be checked. Send a new one.");
    } catch (caught) {
      setError(clerkMessage(firstClerkError(caught)));
    } finally {
      setBusy(false);
    }
  }

  if (step === "code") {
    return (
      <form className="auth-form" noValidate onSubmit={verify}>
        <UiStatus
          kind="restricted"
          heading="Check your email"
          message={`We sent a 6-digit code to ${address.emailAddress}.`}
        />
        <EmailDeliveryHint />
        <FormField
          id="code"
          name="code"
          type="text"
          label="Code from the email"
          hint="6 digits"
          autoComplete="one-time-code"
          inputMode="numeric"
          required
          error={error ?? undefined}
        />
        <button className="auth-form__submit" type="submit" disabled={busy}>
          {busy ? "Checking…" : "Verify email"}
        </button>
        <p className="auth-form__links">
          <button
            type="button"
            className="button button--quiet"
            onClick={() => void send()}
            disabled={busy}
          >
            Send a new code
          </button>
        </p>
      </form>
    );
  }

  return (
    <div className="auth-form">
      <UiStatus
        kind="restricted"
        heading="Confirm your email address"
        message={`Browsing Wanted requests needs a verified email. We will send a 6-digit code to ${address.emailAddress}.`}
      />
      {error ? (
        <p className="form-field__error" role="alert">
          {error}
        </p>
      ) : null}
      <button
        className="auth-form__submit"
        type="button"
        onClick={() => void send()}
        disabled={busy}
      >
        {busy ? "Sending…" : "Send the code"}
      </button>
    </div>
  );
}
