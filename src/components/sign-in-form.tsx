"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSignIn } from "@clerk/nextjs";
import { ErrorSummary, type FieldError } from "./error-summary";
import { FormField } from "./form-field";
import { GoogleIcon } from "./google-icon";
import { UiStatus } from "./ui-status";
import { clerkErrorField, clerkMessage } from "@/features/presentation/auth/clerk-messages";
import { useFinalizeNavigation } from "@/features/presentation/auth/clerk-navigation";
import { DEFAULT_SIGNED_IN_PATH } from "@/features/presentation/auth/redirect-target";
import { useHydrated } from "@/features/presentation/use-hydrated";

type Outcome =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "refused"; message: string; offline?: boolean };

export interface SignInFormProps {
  /**
   * Where to go once signed in.
   *
   * Already validated as same-origin by the page that read it
   * (src/features/presentation/auth/redirect-target.ts). An open redirect on a
   * sign-in screen is a credential phishing route, so the value is never taken
   * straight from the query string here.
   */
  readonly next?: string | undefined;
}

/**
 * Sign-in with Clerk: email and password, or Google.
 *
 * A password sign-in from a device Clerk does not know yet asks for a code
 * sent to the account's email (Clerk device trust) before the session starts.
 * Refusals never say whether an address has an account.
 */
export function SignInForm({ next = DEFAULT_SIGNED_IN_PATH }: SignInFormProps) {
  const { signIn } = useSignIn();
  const finalizeTo = useFinalizeNavigation();
  const [step, setStep] = useState<"credentials" | "code">("credentials");
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

  async function finishOrContinue() {
    if (!signIn) return;
    if (signIn.status === "complete") {
      await signIn.finalize({ navigate: finalizeTo(next) });
      return;
    }
    const emailFactor = signIn.supportedSecondFactors.some(
      (factor) => factor.strategy === "email_code",
    );
    if (
      (signIn.status === "needs_client_trust" || signIn.status === "needs_second_factor") &&
      emailFactor
    ) {
      const { error } = await signIn.mfa.sendEmailCode();
      if (error) return refuse(error);
      setStep("code");
      setOutcome({ kind: "idle" });
      return;
    }
    setOutcome({
      kind: "refused",
      message:
        "This account needs a sign-in step this screen does not support yet. Contact VAULTIX support.",
    });
  }

  async function handleGoogleSignIn() {
    if (!signIn) return;
    setOutcome({ kind: "submitting" });
    const { error } = await signIn.sso({
      strategy: "oauth_google",
      redirectUrl: next,
      redirectCallbackUrl: "/sso-callback",
    });
    if (error) refuse(error);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
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

    if (found.length > 0) {
      setErrors(found);
      setOutcome({ kind: "idle" });
      return;
    }

    if (!signIn) {
      refuse(null);
      return;
    }

    setErrors([]);
    setOutcome({ kind: "submitting" });

    const { error } = await signIn.password({ emailAddress: email, password });
    if (error) return refuse(error);
    await finishOrContinue();
  }

  async function handleCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!signIn) return;

    const code = String(new FormData(event.currentTarget).get("code") ?? "").trim();
    if (code === "") {
      setErrors([{ fieldId: "code", message: "Enter the code from the email." }]);
      return;
    }

    setErrors([]);
    setOutcome({ kind: "submitting" });
    const { error } = await signIn.mfa.verifyEmailCode({ code });
    if (error) return refuse(error);
    await finishOrContinue();
  }

  const errorFor = (fieldId: string) => errors.find((error) => error.fieldId === fieldId)?.message;
  const submitting = outcome.kind === "submitting";
  const refusal =
    outcome.kind === "refused" && errors.length === 0 ? (
      <UiStatus
        kind={outcome.offline ? "offline" : "error"}
        heading="You were not signed in"
        message={outcome.message}
      />
    ) : null;

  if (step === "code") {
    return (
      <form
        className="auth-form"
        noValidate
        onSubmit={handleCode}
        data-hydrated={hydrated ? "true" : "false"}
      >
        <ErrorSummary errors={errors} ref={summaryRef} />
        <UiStatus
          kind="restricted"
          heading="Check your email"
          message="This device is new to your account, so we sent a 6-digit code to your email address. Enter it to finish signing in."
        />
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
        <button className="auth-form__submit" type="submit" disabled={submitting}>
          {submitting ? "Checking…" : "Finish signing in"}
        </button>
        <p className="auth-form__links">
          <button
            type="button"
            className="button button--quiet"
            onClick={() => void signIn?.mfa.sendEmailCode()}
            disabled={submitting}
          >
            Send a new code
          </button>
        </p>
      </form>
    );
  }

  return (
    <form
      className="auth-form"
      noValidate
      onSubmit={handleSubmit}
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

      <FormField
        id="password"
        name="password"
        type="password"
        label="Password"
        autoComplete="current-password"
        required
        error={errorFor("password")}
      />

      <div className="flex flex-col gap-3">
        <button className="auth-form__submit" type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>

        <button
          type="button"
          className="button button--secondary w-full"
          onClick={() => void handleGoogleSignIn()}
          disabled={submitting}
        >
          <GoogleIcon size={18} />
          <span>Continue with Google</span>
        </button>
      </div>

      {submitting ? <UiStatus kind="loading" heading="Checking your details" /> : null}

      <p className="auth-form__links">
        <Link href="/recover">Forgot your password?</Link>
        <Link href="/sign-up">Create an account</Link>
      </p>
    </form>
  );
}
