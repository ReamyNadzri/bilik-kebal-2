"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { callOperation } from "@/features/presentation/call-operation";
import { ErrorSummary, type FieldError } from "./error-summary";
import { FormField } from "./form-field";
import { UiStatus } from "./ui-status";

const subscribeToNothing = () => () => {};
const noStoredEmail = () => "";

/** The address the recovery request was sent for, kept for this tab only. */
function readStoredEmail(): string {
  try {
    return sessionStorage.getItem("vaultix_recovery_email") ?? "";
  } catch {
    return "";
  }
}

type Outcome = "idle" | "submitting" | "updated" | "expired" | "failed";

export function ResetPasswordForm({
  expired = false,
  initialEmail = "",
}: {
  expired?: boolean | undefined;
  initialEmail?: string | undefined;
}) {
  const storedEmail = useSyncExternalStore(subscribeToNothing, readStoredEmail, noStoredEmail);
  const email = initialEmail || storedEmail;
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [outcome, setOutcome] = useState<Outcome>(expired ? "expired" : "idle");
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (errors.length > 0) summaryRef.current?.focus();
  }, [errors]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const enteredEmail = String(form.get("email") ?? "").trim();
    const token = String(form.get("token") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirm-password") ?? "");
    const nextErrors: FieldError[] = [];

    if (token || enteredEmail) {
      if (!enteredEmail || !enteredEmail.includes("@")) {
        nextErrors.push({ fieldId: "email", message: "Enter your valid email address." });
      }
      if (token.length < 6) {
        nextErrors.push({
          fieldId: "token",
          message: "Enter the 6-digit recovery code from your email.",
        });
      }
    }

    if (
      password.length < 8 ||
      password.length > 72 ||
      !/[a-z]/.test(password) ||
      !/[A-Z]/.test(password) ||
      !/[0-9]/.test(password)
    ) {
      nextErrors.push({
        fieldId: "new-password",
        message: "Use 8–72 characters with a lowercase letter, an uppercase letter and a number.",
      });
    }
    if (password !== confirmation) {
      nextErrors.push({ fieldId: "confirm-password", message: "The passwords do not match." });
    }

    if (nextErrors.length > 0) {
      setErrors(nextErrors);
      setOutcome("idle");
      return;
    }

    setErrors([]);
    setOutcome("submitting");

    const payload: { password: string; email?: string; token?: string } = { password };
    if (token && enteredEmail) {
      payload.email = enteredEmail;
      payload.token = token;
    }

    const result = await callOperation<{ updated: true }, string>(
      "/api/auth/reset-password",
      payload,
      "AUTH_UNAVAILABLE",
    );

    if (result.ok) {
      setOutcome("updated");
      try {
        sessionStorage.removeItem("vaultix_recovery_email");
      } catch {}
      return;
    }
    if (result.code === "RECOVERY_LINK_INVALID") {
      setOutcome("expired");
      return;
    }

    const fieldErrors = Object.entries(result.fieldErrors ?? {}).flatMap(([fieldId, messages]) =>
      messages.map((message) => ({ fieldId, message })),
    );
    setErrors(fieldErrors);
    setOutcome("failed");
  }

  if (outcome === "expired") {
    return (
      <section className="auth-form">
        <UiStatus
          kind="expired"
          heading="This recovery link is invalid or expired"
          message="If you received a 6-digit recovery code by email, you can enter it below, or request a new code."
        />
        <button
          type="button"
          className="auth-form__submit"
          onClick={() => setOutcome("idle")}
          style={{ marginBottom: "1rem" }}
        >
          Enter 6-digit recovery code
        </button>
        <p className="auth-form__links">
          <Link href="/recover">Request another link</Link>
          <Link href="/sign-in">Back to sign in</Link>
        </p>
      </section>
    );
  }

  if (outcome === "updated") {
    return (
      <section className="auth-form">
        <UiStatus
          kind="success"
          heading="Password updated"
          message="You can now sign in with your new password."
        />
        <p className="auth-form__links">
          <Link href="/sign-in">Sign in</Link>
        </p>
      </section>
    );
  }

  const submitting = outcome === "submitting";
  return (
    <form className="auth-form" noValidate onSubmit={handleSubmit}>
      <ErrorSummary errors={errors} ref={summaryRef} />
      {outcome === "failed" && errors.length === 0 ? (
        <UiStatus
          kind="offline"
          heading="Password was not updated"
          message="The request failed. Check the code and try again, or request a new one."
        />
      ) : null}
      <FormField
        id="email"
        name="email"
        type="email"
        label="Email address"
        autoComplete="email"
        defaultValue={email}
        key={email}
        hint="The email address you requested password recovery for."
        error={errors.find((error) => error.fieldId === "email")?.message}
      />
      <FormField
        id="token"
        name="token"
        type="text"
        label="6-digit recovery code"
        placeholder="e.g. 123456"
        autoComplete="one-time-code"
        hint="Enter the 6-digit verification code from your email (leave blank if opening a direct link)."
        error={errors.find((error) => error.fieldId === "token")?.message}
      />
      <FormField
        id="new-password"
        name="password"
        type="password"
        label="New password"
        autoComplete="new-password"
        required
        error={errors.find((error) => error.fieldId === "new-password")?.message}
      />
      <FormField
        id="confirm-password"
        name="confirm-password"
        type="password"
        label="Confirm new password"
        autoComplete="new-password"
        required
        error={errors.find((error) => error.fieldId === "confirm-password")?.message}
      />
      <button className="auth-form__submit" type="submit" disabled={submitting}>
        {submitting ? "Updating…" : "Set new password"}
      </button>
      {submitting ? <UiStatus kind="loading" heading="Updating your password" /> : null}
      <p className="auth-form__links">
        <Link href="/recover">Request a new recovery link</Link>
      </p>
    </form>
  );
}
