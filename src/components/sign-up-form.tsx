"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ErrorSummary, type FieldError } from "./error-summary";
import { FormField } from "./form-field";
import { UiStatus } from "./ui-status";
import { useHydrated } from "@/features/presentation/use-hydrated";

const MINIMUM_PASSWORD_LENGTH = 12;

/**
 * Registration presentation.
 *
 * Fixture-only: presence, length and confirmation checks are presentational so
 * the states are reviewable. It creates no account and sends no email. The
 * copy states the product rule that an account alone does not permit
 * transacting — institution verification is a separate trust state.
 */
export function SignUpForm() {
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
    const confirmation = String(form.get("confirm-password") ?? "");

    const found: FieldError[] = [];

    if (email === "") {
      found.push({ fieldId: "email", message: "Enter your email address." });
    }

    if (password === "") {
      found.push({ fieldId: "password", message: "Enter a password." });
    } else if (password.length < MINIMUM_PASSWORD_LENGTH) {
      found.push({
        fieldId: "password",
        message: `Use a password of at least ${MINIMUM_PASSWORD_LENGTH} characters.`,
      });
    }

    if (confirmation === "") {
      found.push({ fieldId: "confirm-password", message: "Confirm your password." });
    } else if (password !== "" && confirmation !== password) {
      found.push({
        fieldId: "confirm-password",
        message: "This does not match the password you entered.",
      });
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

      <p className="auth-form__intro">
        Any email address may register. Browsing Wanted metadata needs a verified email; funding a
        bounty, submitting a claim and downloading a resource each additionally require institution
        verification.
      </p>

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
        autoComplete="new-password"
        hint={`At least ${MINIMUM_PASSWORD_LENGTH} characters.`}
        required
        error={errorFor("password")}
      />

      <FormField
        id="confirm-password"
        name="confirm-password"
        type="password"
        label="Confirm password"
        autoComplete="new-password"
        required
        error={errorFor("confirm-password")}
      />

      <button className="auth-form__submit" type="submit">
        Create account
      </button>

      {submittedCleanly ? (
        <UiStatus
          kind="offline"
          heading="No account was created"
          message="The form is valid, but this screen is not connected to a registration operation yet. No verification email was sent."
        />
      ) : null}

      <p className="auth-form__links">
        <Link href="/sign-in">Already have an account?</Link>
      </p>
    </form>
  );
}
