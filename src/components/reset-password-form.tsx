"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { callOperation } from "@/features/presentation/call-operation";
import { ErrorSummary, type FieldError } from "./error-summary";
import { FormField } from "./form-field";
import { UiStatus } from "./ui-status";

type Outcome = "idle" | "submitting" | "updated" | "expired" | "failed";

export function ResetPasswordForm({ expired = false }: { expired?: boolean }) {
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [outcome, setOutcome] = useState<Outcome>(expired ? "expired" : "idle");
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (errors.length > 0) summaryRef.current?.focus();
  }, [errors]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirm-password") ?? "");
    const nextErrors: FieldError[] = [];

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
    const result = await callOperation<{ updated: true }, string>(
      "/api/auth/reset-password",
      { password },
      "AUTH_UNAVAILABLE",
    );

    if (result.ok) {
      setOutcome("updated");
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
          message="Request a new recovery email, then open its latest link on this device."
        />
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
          message="The request failed. Check the link and try again, or request a new one."
        />
      ) : null}
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
