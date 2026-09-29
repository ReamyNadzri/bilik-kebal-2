"use client";

import { useState, type FormEvent } from "react";
import { useSession } from "@clerk/nextjs";
import type { VerificationOperationCode } from "@/contracts";
import { IDENTITY_MESSAGE } from "@/features/presentation/identity-messages";
import { callOperation } from "@/features/presentation/call-operation";
import { clerkMessage, type ClerkErrorLike } from "@/features/presentation/auth/clerk-messages";

export interface ConfirmIdentityProps {
  /** What the password unlocks, e.g. "view this evidence". */
  readonly purpose: string;
  /** Called once the password is confirmed; usually retries the action. */
  readonly onConfirmed: () => void;
}

const WRONG_PASSWORD = "That password is not correct.";
const NO_PASSWORD =
  "Your account has no password to confirm with (it signs in with Google). Set a password in your account settings, then try again.";

function firstClerkError(error: unknown): ClerkErrorLike | null {
  const errors = (error as { errors?: ClerkErrorLike[] } | null)?.errors;
  return Array.isArray(errors) && errors[0] ? errors[0] : null;
}

/**
 * The step-up prompt for Sheriff and Owner actions. Viewing evidence and
 * recording a decision need the password entered within the last 15 minutes;
 * staying signed in does not renew that. Re-entering it here renews it
 * without leaving the page. The session itself is never ended.
 *
 * With a Clerk session this is Clerk session reverification: the refreshed
 * session token carries the new verification age (`fva`) that the server and
 * the database check. A session still on Supabase Auth uses the old route.
 */
export function ConfirmIdentity({ purpose, onConfirmed }: ConfirmIdentityProps) {
  const { session } = useSession();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmWithClerk(): Promise<string | null> {
    if (!session) return null;
    try {
      await session.startVerification({ level: "first_factor" });
      const verification = await session.attemptFirstFactorVerification({
        strategy: "password",
        password,
      });
      if (verification.status !== "complete") return WRONG_PASSWORD;
      // The next request must carry the new verification age.
      await session.getToken({ skipCache: true });
      return null;
    } catch (caught) {
      const clerkError = firstClerkError(caught);
      if (clerkError?.code === "form_password_incorrect") return WRONG_PASSWORD;
      if (clerkError?.code === "strategy_for_user_invalid") return NO_PASSWORD;
      return clerkMessage(clerkError);
    }
  }

  async function confirmWithSupabase(): Promise<string | null> {
    const result = await callOperation<{ next: "profile" }, VerificationOperationCode>(
      "/api/auth/reauthenticate",
      { password },
      "AUTH_UNAVAILABLE",
    );
    if (result.ok) return null;
    return result.code === "INVALID_CREDENTIALS"
      ? WRONG_PASSWORD
      : result.message || IDENTITY_MESSAGE[result.code];
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Never let this submit reach a surrounding form's handler.
    event.stopPropagation();
    if (password === "") {
      setError("Enter your password.");
      return;
    }
    setBusy(true);
    setError(null);
    const refusal = session ? await confirmWithClerk() : await confirmWithSupabase();
    setBusy(false);
    setPassword("");
    if (refusal) {
      setError(refusal);
      return;
    }
    onConfirmed();
  }

  return (
    <form className="ops-form confirm-identity" onSubmit={onSubmit} noValidate>
      <h3 className="ops-panel__title">Confirm it is you</h3>
      <p className="form-field__hint" id="confirm-identity-hint">
        You are still signed in. To {purpose}, enter your password again. Sheriffs and the Owner are
        asked for it when they last entered it over 15 minutes ago.
      </p>
      {error ? (
        <p className="form-field__error" id="confirm-identity-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="form-field">
        <label className="form-field__label" htmlFor="confirm-identity-password">
          Password
        </label>
        <input
          className="form-field__input"
          id="confirm-identity-password"
          type="password"
          autoComplete="current-password"
          value={password}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            error ? "confirm-identity-hint confirm-identity-error" : "confirm-identity-hint"
          }
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      <div>
        <button type="submit" className="button button--primary" disabled={busy}>
          {busy ? "Checking…" : "Confirm and continue"}
        </button>
      </div>
    </form>
  );
}
