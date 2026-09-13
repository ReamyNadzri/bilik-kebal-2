"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ErrorSummary, type FieldError } from "./error-summary";
import { FormField } from "./form-field";
import { UiStatus } from "./ui-status";
import { useHydrated } from "@/features/presentation/use-hydrated";

/**
 * Sign-in presentation.
 *
 * Fixture-only: it performs presence checks so the validation, failure and
 * result states are real and reviewable, then reports that no operation is
 * connected. It authenticates nothing, stores nothing and decides no trust
 * state. Replace the submit handler with the Codex-owned authentication
 * operation, and drop the fixture status, in the slice that connects it.
 */
export function SignInForm() {
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [attempted, setAttempted] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const hydrated = useHydrated();

  useEffect(() => {
    if (errors.length > 0) {
      summaryRef.current?.focus();
    }
  }, [errors]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    const found: FieldError[] = [];
    if (email === "") {
      found.push({ fieldId: "email", message: "Enter your email address." });
    }
    if (password === "") {
      found.push({ fieldId: "password", message: "Enter your password." });
    }

    setErrors(found);
    setAttempted(true);
  }

  const errorFor = (fieldId: string) => errors.find((error) => error.fieldId === fieldId)?.message;
  const submittedCleanly = attempted && errors.length === 0;

  return (
    <form
      className="auth-form"
      noValidate
      onSubmit={handleSubmit}
      data-hydrated={hydrated ? "true" : "false"}
    >
      <ErrorSummary errors={errors} ref={summaryRef} />

      <FormField
        id="email"
        name="email"
        type="email"
        label="Email address"
        autoComplete="email"
        required
        error={errorFor("email")}
      />

      <FormField
        id="password"
        name="password"
        type="password"
        label="Password"
        autoComplete="current-password"
        required
        error={errorFor("password")}
      />

      <button className="auth-form__submit" type="submit">
        Sign in
      </button>

      {submittedCleanly ? (
        <UiStatus
          kind="offline"
          heading="No account was signed in"
          message="The form is valid, but this screen is not connected to an authentication operation yet."
        />
      ) : null}

      <p className="auth-form__links">
        <Link href="/recover">Forgot your password?</Link>
        <Link href="/sign-up">Create an account</Link>
      </p>
    </form>
  );
}
