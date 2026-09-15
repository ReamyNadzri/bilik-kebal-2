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
  const summaryRef = useRef<HTMLDivElement>(null);
  const hydrated = useHydrated();

  useEffect(() => {
    if (errors.length > 0) {
      summaryRef.current?.focus();
    }
  }, [errors]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

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
        <UiStatus
          kind="empty"
          heading="If an account exists for that address, a recovery link is on its way"
          message="Open the link to choose a new password. It expires after a short time, and you can request another from this screen."
        />
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

      <button className="auth-form__submit" type="submit" disabled={submitting}>
        {submitting ? "Sending…" : "Send recovery link"}
      </button>

      {submitting ? <UiStatus kind="loading" heading="Sending the recovery link" /> : null}

      <p className="auth-form__links">
        <Link href="/sign-in">Back to sign in</Link>
      </p>
    </form>
  );
}
