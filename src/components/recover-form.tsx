"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ErrorSummary, type FieldError } from "./error-summary";
import { FormField } from "./form-field";
import { UiStatus } from "./ui-status";
import type { IdentityOperationCode, PasswordRecoveryResult } from "@/contracts";
import { callOperation } from "@/features/presentation/call-operation";
import { IDENTITY_MESSAGE } from "@/features/presentation/identity-messages";
import { useHydrated } from "@/features/presentation/use-hydrated";

const COOLDOWN_SECONDS = 120;
const STORAGE_KEY = "vaultix_recovery_cooldown";

function getInitialCooldown(): number {
  if (typeof window === "undefined") return 0;
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return 0;
    const remaining = Math.ceil((Number(stored) - Date.now()) / 1000);
    return remaining > 0 ? remaining : 0;
  } catch {
    return 0;
  }
}

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
  const [cooldown, setCooldown] = useState(0);
  const summaryRef = useRef<HTMLDivElement>(null);
  const hydrated = useHydrated();

  useEffect(() => {
    setCooldown(getInitialCooldown());
  }, []);

  useEffect(() => {
    if (errors.length > 0) {
      summaryRef.current?.focus();
    }
  }, [errors]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          try {
            sessionStorage.removeItem(STORAGE_KEY);
          } catch {}
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

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
      setCooldown(COOLDOWN_SECONDS);
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
