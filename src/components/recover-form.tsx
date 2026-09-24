"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { ErrorSummary, type FieldError } from "./error-summary";
import { FormField } from "./form-field";
import { UiStatus } from "./ui-status";
import type { IdentityOperationCode, PasswordRecoveryResult } from "@/contracts";
import { callOperation } from "@/features/presentation/call-operation";
import { IDENTITY_MESSAGE } from "@/features/presentation/identity-messages";
import { useHydrated } from "@/features/presentation/use-hydrated";

const COOLDOWN_SECONDS = 120;
const STORAGE_KEY = "vaultix_recovery_cooldown";

/** The stored cooldown expiry, read once the form is in the browser. */
function readStoredExpiry(): number | null {
  try {
    const stored = Number(sessionStorage.getItem(STORAGE_KEY));
    return Number.isFinite(stored) && stored > 0 ? stored : null;
  } catch {
    return null;
  }
}

const subscribeToNothing = () => () => {};
const noStoredExpiry = () => null;

function formatCooldown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

type Outcome =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "accepted" }
  | { kind: "refused"; code: IdentityOperationCode; message: string };

/**
 * Password recovery, wired to POST /api/auth/recovery.
 *
 * The operation returns success for unknown addresses by design, and this
 * screen must not undo that: the confirmation never says whether an account
 * exists and never echoes the address back, so the screen cannot be used to
 * enumerate accounts.
 */
export function RecoverForm() {
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });
  const storedExpiry = useSyncExternalStore(subscribeToNothing, readStoredExpiry, noStoredExpiry);
  const [issuedExpiry, setIssuedExpiry] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const summaryRef = useRef<HTMLDivElement>(null);
  const hydrated = useHydrated();
  const expiry = issuedExpiry ?? storedExpiry;
  const cooldown = expiry === null ? 0 : Math.max(0, Math.ceil((expiry - now) / 1000));

  useEffect(() => {
    if (errors.length > 0) {
      summaryRef.current?.focus();
    }
  }, [errors]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (expiry !== null && current >= expiry) {
        try {
          sessionStorage.removeItem(STORAGE_KEY);
        } catch {}
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown, expiry]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (cooldown > 0) {
      return;
    }

    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();

    if (email === "") {
      setErrors([{ fieldId: "email", message: "Enter your email address." }]);
      setOutcome({ kind: "idle" });
      return;
    }

    setErrors([]);
    setOutcome({ kind: "submitting" });

    const result = (await callOperation<{ accepted: true }, IdentityOperationCode>(
      "/api/auth/recovery",
      { email },
      "AUTH_UNAVAILABLE",
    )) as PasswordRecoveryResult;

    if (result.ok) {
      setOutcome({ kind: "accepted" });
      const expiry = Date.now() + COOLDOWN_SECONDS * 1000;
      try {
        sessionStorage.setItem(STORAGE_KEY, String(expiry));
        sessionStorage.setItem("vaultix_recovery_email", email);
      } catch {}
      setNow(Date.now());
      setIssuedExpiry(expiry);
      return;
    }

    const mapped = Object.entries(result.fieldErrors ?? {}).flatMap(([fieldId, messages]) =>
      messages.map((message) => ({ fieldId, message })),
    );

    setErrors(mapped);
    setOutcome({
      kind: "refused",
      code: result.code,
      message: result.message === "" ? IDENTITY_MESSAGE[result.code] : result.message,
    });
  }

  const submitting = outcome.kind === "submitting";

  return (
    <form
      className="auth-form"
      noValidate
      onSubmit={handleSubmit}
      data-hydrated={hydrated ? "true" : "false"}
    >
      <ErrorSummary errors={errors} ref={summaryRef} />

      {outcome.kind === "accepted" ? (
        <div style={{ display: "grid", gap: "0.75rem", marginBottom: "1rem" }}>
          <UiStatus
            kind="empty"
            heading="If an account exists for that address, a recovery code is on its way"
            message="Check your email for the 6-digit verification code. Once received, enter it to set a new password."
          />
          <p className="auth-form__links" style={{ textAlign: "center" }}>
            <Link
              href="/reset-password"
              style={{ fontWeight: "bold", textDecoration: "underline" }}
            >
              Enter 6-digit recovery code &rarr;
            </Link>
          </p>
        </div>
      ) : null}

      {outcome.kind === "refused" && errors.length === 0 ? (
        <UiStatus
          kind={outcome.code === "AUTH_UNAVAILABLE" ? "offline" : "error"}
          heading="The request could not be sent"
          message={outcome.message}
        />
      ) : null}

      <FormField
        id="email"
        name="email"
        type="email"
        label="Email address"
        autoComplete="email"
        required
        error={errors.find((error) => error.fieldId === "email")?.message}
      />

      <button className="auth-form__submit" type="submit" disabled={submitting || cooldown > 0}>
        {submitting
          ? "Sending…"
          : cooldown > 0
            ? `Send recovery link (wait ${formatCooldown(cooldown)})`
            : "Send recovery link"}
      </button>

      {submitting ? <UiStatus kind="loading" heading="Sending the recovery link" /> : null}

      <p className="auth-form__links">
        <Link href="/sign-in">Back to sign in</Link>
      </p>
    </form>
  );
}
