"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSignUp } from "@clerk/nextjs";
import { ErrorSummary, type FieldError } from "./error-summary";
import { FormField } from "./form-field";
import { GoogleIcon } from "./google-icon";
import { UiStatus } from "./ui-status";
import { clerkErrorField, clerkMessage } from "@/features/presentation/auth/clerk-messages";
import {
  syncClerkAccount,
  useFinalizeNavigation,
} from "@/features/presentation/auth/clerk-navigation";
import { DEFAULT_SIGNED_IN_PATH } from "@/features/presentation/auth/redirect-target";
import { useHydrated } from "@/features/presentation/use-hydrated";

const MINIMUM_PASSWORD_LENGTH = 12;

type Outcome =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "refused"; message: string; offline?: boolean };

/**
 * Registration with Clerk: the account is created, Clerk emails a 6-digit
 * code, and the session starts once the code is entered, so every account
 * that reaches VAULTIX has a verified email.
 */
export function SignUpForm() {
  const { signUp } = useSignUp();
  const finalizeTo = useFinalizeNavigation();
  const [step, setStep] = useState<"details" | "code">("details");
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });
  const [resent, setResent] = useState(false);
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

  async function finish() {
    if (!signUp) return;
    await syncClerkAccount();
    await signUp.finalize({ navigate: finalizeTo(DEFAULT_SIGNED_IN_PATH) });
  }

  async function handleGoogleSignUp() {
    if (!signUp) return;
    setOutcome({ kind: "submitting" });
    const { error } = await signUp.sso({
      strategy: "oauth_google",
      redirectUrl: DEFAULT_SIGNED_IN_PATH,
      redirectCallbackUrl: "/sso-callback",
    });
    if (error) refuse(error);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const displayName = String(form.get("display-name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirm-password") ?? "");

    const found: FieldError[] = [];

    if (displayName === "") {
      found.push({ fieldId: "display-name", message: "Enter the name other students will see." });
    }

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

    if (found.length > 0) {
      setErrors(found);
      setOutcome({ kind: "idle" });
      return;
    }

    if (!signUp) {
      refuse(null);
      return;
    }

    setErrors([]);
    setOutcome({ kind: "submitting" });

    // The display name travels as the first name; it becomes the profile name
    // once, when the account is provisioned, and belongs to the member after.
    const { error } = await signUp.password({
      emailAddress: email,
      password,
      firstName: displayName,
    });
    if (error) return refuse(error);

    if (signUp.status === "complete") {
      await finish();
      return;
    }

    const { error: sendError } = await signUp.verifications.sendEmailCode();
    if (sendError) return refuse(sendError);
    setStep("code");
    setOutcome({ kind: "idle" });
  }

  async function handleCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!signUp) return;

    const code = String(new FormData(event.currentTarget).get("code") ?? "").trim();
    if (code === "") {
      setErrors([{ fieldId: "code", message: "Enter the code from the email." }]);
      return;
    }

    setErrors([]);
    setOutcome({ kind: "submitting" });
    const { error } = await signUp.verifications.verifyEmailCode({ code });
    if (error) return refuse(error);

    if (signUp.status === "complete") {
      await finish();
      return;
    }
    setOutcome({
      kind: "refused",
      message:
        "Your email is confirmed, but the account needs more details. Contact VAULTIX support.",
    });
  }

  async function resend() {
    if (!signUp) return;
    const { error } = await signUp.verifications.sendEmailCode();
    if (error) return refuse(error);
    setResent(true);
  }

  const errorFor = (fieldId: string) => errors.find((error) => error.fieldId === fieldId)?.message;
  const submitting = outcome.kind === "submitting";
  const refusal =
    outcome.kind === "refused" && errors.length === 0 ? (
      <UiStatus
        kind={outcome.offline ? "offline" : "error"}
        heading={step === "code" ? "Your email is not confirmed yet" : "No account was created"}
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
          message="We sent a 6-digit code to your email address. Enter it to finish creating your account."
        />
        {refusal}
        {resent ? <p role="status">A new code is on its way.</p> : null}

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
          {submitting ? "Checking…" : "Confirm and create account"}
        </button>

        <p className="auth-form__links">
          <button
            type="button"
            className="button button--quiet"
            onClick={() => void resend()}
            disabled={submitting}
          >
            Send a new code
          </button>
          <button
            type="button"
            className="button button--quiet"
            onClick={() => {
              setStep("details");
              setErrors([]);
              setOutcome({ kind: "idle" });
            }}
          >
            Use a different email
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

      <p className="auth-form__intro">
        Any email address may register. Browsing Wanted metadata needs a verified email; funding a
        bounty, submitting a claim and downloading a resource each additionally require institution
        verification.
      </p>

      {refusal}

      <FormField
        id="display-name"
        name="display-name"
        type="text"
        label="Display name"
        hint="Shown to other students on your Wanted requests and claims."
        autoComplete="nickname"
        required
        error={errorFor("display-name")}
      />

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

      {/* Clerk's bot protection renders its challenge here when it needs one. */}
      <div id="clerk-captcha" />

      <div className="flex flex-col gap-3">
        <button className="auth-form__submit" type="submit" disabled={submitting}>
          {submitting ? "Creating your account…" : "Create account"}
        </button>

        <button
          type="button"
          className="button button--secondary w-full"
          onClick={() => void handleGoogleSignUp()}
          disabled={submitting}
        >
          <GoogleIcon size={18} />
          <span>Continue with Google</span>
        </button>
      </div>

      {submitting ? <UiStatus kind="loading" heading="Creating your account" /> : null}

      <p className="auth-form__links">
        <Link href="/sign-in">Already have an account?</Link>
      </p>
    </form>
  );
}
