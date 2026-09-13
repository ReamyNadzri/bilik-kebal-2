"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ErrorSummary, type FieldError } from "./error-summary";
import { FormField } from "./form-field";
import { UiStatus } from "./ui-status";
import { useHydrated } from "@/features/presentation/use-hydrated";

/**
 * Password recovery presentation.
 *
 * Fixture-only: it sends nothing. The result deliberately does not say whether
 * an account exists for the address, so the screen cannot be used to enumerate
 * accounts — the wording must stay neutral when the real operation is wired in.
 */
export function RecoverForm() {
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

    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    const found: FieldError[] =
      email === "" ? [{ fieldId: "email", message: "Enter your email address." }] : [];

    setErrors(found);
    setAttempted(true);
  }

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
        error={errors.find((error) => error.fieldId === "email")?.message}
      />

      <button className="auth-form__submit" type="submit">
        Send recovery link
      </button>

      {submittedCleanly ? (
        <UiStatus
          kind="offline"
          heading="If an account exists for that address, a recovery link would be sent"
          message="This screen is not connected to a recovery operation yet, so no email was sent."
        />
      ) : null}

      <p className="auth-form__links">
        <Link href="/sign-in">Back to sign in</Link>
      </p>
    </form>
  );
}
