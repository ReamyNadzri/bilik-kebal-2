"use client";

import { useState, type FormEvent } from "react";
import type { VerificationOperationCode } from "@/contracts";
import { IDENTITY_MESSAGE } from "@/features/presentation/identity-messages";
import { callOperation } from "@/features/presentation/call-operation";

export interface ConfirmIdentityProps {
  /** What the password unlocks, e.g. "view this evidence". */
  readonly purpose: string;
  /** Called once the password is confirmed; usually retries the action. */
  readonly onConfirmed: () => void;
}

/**
 * The step-up prompt for Sheriff and Owner actions. Viewing evidence and
 * recording a decision need a sign-in within the last 15 minutes; staying
 * signed in does not renew that. Re-entering the password here renews it
 * without leaving the page. The session itself is never ended.
 */
export function ConfirmIdentity({ purpose, onConfirmed }: ConfirmIdentityProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password === "") {
      setError("Enter your password.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await callOperation<{ next: "profile" }, VerificationOperationCode>(
      "/api/auth/reauthenticate",
      { password },
      "AUTH_UNAVAILABLE",
    );
    setBusy(false);
    setPassword("");
    if (!result.ok) {
      setError(
        result.code === "INVALID_CREDENTIALS"
          ? "That password is not correct."
          : result.message || IDENTITY_MESSAGE[result.code],
      );
      return;
    }
    onConfirmed();
  }

  return (
    <form className="ops-form confirm-identity" onSubmit={onSubmit} noValidate>
      <h3 className="ops-panel__title">Confirm it is you</h3>
      <p className="form-field__hint" id="confirm-identity-hint">
        You are still signed in. To {purpose}, enter your password again. Sheriffs and the Owner are
        asked for it when their last sign-in was over 15 minutes ago.
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
