"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSignIn } from "@clerk/nextjs";
import { ErrorSummary, type FieldError } from "./error-summary";
import { FormField } from "./form-field";
import { UiStatus } from "./ui-status";
import { EmailDeliveryHint } from "./email-delivery-hint";
import { clerkErrorField, clerkMessage } from "@/features/presentation/auth/clerk-messages";
import { useFinalizeNavigation } from "@/features/presentation/auth/clerk-navigation";
import { DEFAULT_SIGNED_IN_PATH } from "@/features/presentation/auth/redirect-target";
import { useHydrated } from "@/features/presentation/use-hydrated";

const MINIMUM_PASSWORD_LENGTH = 12;

/** Clerk refusals that would reveal whether an address has an account. */
const ACCOUNT_EXISTENCE_CODES = new Set(["form_identifier_not_found", "strategy_for_user_invalid"]);

type Outcome =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "refused"; message: string; offline?: boolean };

/**
 * Password recovery with Clerk: a 6-digit code goes to the address, and the
 * code plus a new password signs the member in.
 *
 * The screen answers the same whether or not the address has an account, so
 * it cannot be used to find out who is registered.
 */
export function RecoverForm() {
  const { signIn } = useSignIn();
  const finalizeTo = useFinalizeNavigation();
  const [step, setStep] = useState<"email" | "reset">("email");
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });
  const summaryRef = useRef<HTMLDivElement>(null);
  const hydrated = useHydrated();

  useEffect(() => {
    if (errors.length > 0) {
      summaryRef.current?.focus();
    }
  }, [errors]);

  function refuse(error: Parameters<typeof clerkMessage>[0]) {
    const message = clerkMessage(error);
    const field = error ? clerkErrorField(error) : null;
    setErrors(field ? [{ fieldId: field, message }] : []);
    setOutcome({ kind: "refused", message, offline: !error });
  }

  async function handleEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();

    if (email === "") {
      setErrors([{ fieldId: "email", message: "Enter your email address." }]);
      setOutcome({ kind: "idle" });
      return;
    }
    if (!signIn) {
      refuse(null);
      return;
    }

    setErrors([]);
    setOutcome({ kind: "submitting" });

    const { error } = await signIn.create({ identifier: email });
    if (error && !ACCOUNT_EXISTENCE_CODES.has(error.code)) return refuse(error);
    if (!error) {
      const { error: sendError } = await signIn.resetPasswordEmailCode.sendCode();
      if (sendError && !ACCOUNT_EXISTENCE_CODES.has(sendError.code)) return refuse(sendError);
    }

    setStep("reset");
    setOutcome({ kind: "idle" });
  }

  async function handleReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!signIn) return;

    const form = new FormData(event.currentTarget);
    const code = String(form.get("code") ?? "").trim();
    const password = String(form.get("password") ?? "");

    const found: FieldError[] = [];
    if (code === "") found.push({ fieldId: "code", message: "Enter the code from the email." });
    if (password.length < MINIMUM_PASSWORD_LENGTH) {
      found.push({
        fieldId: "password",
        message: `Use a password of at least ${MINIMUM_PASSWORD_LENGTH} characters.`,
      });
    }
    if (found.length > 0) {
      setErrors(found);
      return;
    }

    setErrors([]);
    setOutcome({ kind: "submitting" });

    const { error } = await signIn.resetPasswordEmailCode.verifyCode({ code });
    if (error) return refuse(error);
    const { error: passwordError } = await signIn.resetPasswordEmailCode.submitPassword({
      password,
    });
    if (passwordError) return refuse(passwordError);

    if (signIn.status === "complete") {
      await signIn.finalize({ navigate: finalizeTo(DEFAULT_SIGNED_IN_PATH) });
      return;
    }
    setOutcome({
      kind: "refused",
      message: "Your password was changed. Sign in with the new password to continue.",
    });
  }

  const errorFor = (fieldId: string) => errors.find((error) => error.fieldId === fieldId)?.message;
  const submitting = outcome.kind === "submitting";
  const refusal =
    outcome.kind === "refused" && errors.length === 0 ? (
      <UiStatus
        kind={outcome.offline ? "offline" : "error"}
        heading={step === "reset" ? "Your password was not changed" : "The code could not be sent"}
        message={outcome.message}
      />
    ) : null;

  if (step === "reset") {
    return (
      <form
        className="auth-form"
        noValidate
        onSubmit={handleReset}
        data-hydrated={hydrated ? "true" : "false"}
      >
        <ErrorSummary errors={errors} ref={summaryRef} />
        <UiStatus
          kind="empty"
          heading="If an account exists for that address, a code is on its way"
          message="Enter the 6-digit code from the email and choose a new password."
        />
        <EmailDeliveryHint />
        {refusal}

        <FormField
          id="code"
          name="code"
          type="text"
          label="Code from the email"
          hint="6 digits"
          autoComplete="one-time-code"
          inputMode="numeric"
          required
          error={errorFor("code")}
        />
        <FormField
          id="password"
          name="password"
          type="password"
          label="New password"
          hint={`At least ${MINIMUM_PASSWORD_LENGTH} characters.`}
          autoComplete="new-password"
          required
          error={errorFor("password")}
        />

        <button className="auth-form__submit" type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Set new password"}
        </button>

        <p className="auth-form__links">
          <button
            type="button"
            className="button button--quiet"
            onClick={() => {
              setStep("email");
              setErrors([]);
              setOutcome({ kind: "idle" });
            }}
          >
            Use a different email
          </button>
          <Link href="/sign-in">Back to sign in</Link>
        </p>
      </form>
    );
  }

  return (
    <form
      className="auth-form"
      noValidate
      onSubmit={handleEmail}
      data-hydrated={hydrated ? "true" : "false"}
    >
      <ErrorSummary errors={errors} ref={summaryRef} />
      {refusal}

      <FormField
        id="email"
        name="email"
        type="email"
        label="Email address"
        autoComplete="email"
        required
        error={errorFor("email")}
      />

      <button className="auth-form__submit" type="submit" disabled={submitting}>
        {submitting ? "Sending…" : "Send a reset code"}
      </button>

      {submitting ? <UiStatus kind="loading" heading="Sending the reset code" /> : null}

      <p className="auth-form__links">
        <Link href="/sign-in">Back to sign in</Link>
      </p>
    </form>
  );
}
