"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSignUp } from "@clerk/nextjs";
import { ErrorSummary, type FieldError } from "./error-summary";
import { FormField } from "./form-field";
import { GoogleIcon } from "./google-icon";
import { UiStatus } from "./ui-status";
import type { IdentityOperationCode, RegistrationResult } from "@/contracts";
import { callOperation } from "@/features/presentation/call-operation";
import { IDENTITY_MESSAGE } from "@/features/presentation/identity-messages";
import { useHydrated } from "@/features/presentation/use-hydrated";

const MINIMUM_PASSWORD_LENGTH = 12;

type Outcome =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "refused"; code: IdentityOperationCode; message: string };

/**
 * Registration, wired to POST /api/auth/sign-up and Clerk useSignUp.
 */
export function SignUpForm() {
  const router = useRouter();
  const { signUp: clerkSignUp } = useSignUp();
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const summaryRef = useRef<HTMLDivElement>(null);
  const hydrated = useHydrated();

  useEffect(() => {
    if (errors.length > 0) {
      summaryRef.current?.focus();
    }
  }, [errors]);

  async function handleGoogleSignUp() {
    if (!clerkSignUp) return;
    try {
      await clerkSignUp.sso({
        strategy: "oauth_google",
        redirectUrl: "/profile",
        redirectCallbackUrl: "/sso-callback",
      });
    } catch (err: unknown) {
      console.error("Google sign up error", err);
    }
  }

  async function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clerkSignUp) return;

    if (verificationCode.trim() === "") {
      setErrors([{ fieldId: "code", message: "Enter the verification code sent to your email." }]);
      return;
    }

    setErrors([]);
    setOutcome({ kind: "submitting" });

    try {
      const { error: verifyErr } = await clerkSignUp.verifications.verifyEmailCode({
        code: verificationCode.trim(),
      });

      if (verifyErr) {
        setErrors([{ fieldId: "code", message: verifyErr.message }]);
        setOutcome({
          kind: "refused",
          code: "INVALID_CREDENTIALS",
          message: verifyErr.message,
        });
        return;
      }

      if (clerkSignUp.status === "complete") {
        await clerkSignUp.finalize({
          navigate: ({ decorateUrl }) => {
            const url = decorateUrl("/profile");
            if (url.startsWith("http")) {
              window.location.href = url;
            } else {
              router.replace(url);
              router.refresh();
            }
          },
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Verification failed. Try again.";
      setOutcome({
        kind: "refused",
        code: "AUTH_UNAVAILABLE",
        message,
      });
    }
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

    setErrors([]);
    setOutcome({ kind: "submitting" });

    // Authenticate with Clerk when available
    if (clerkSignUp) {
      try {
        const { error: clerkErr } = await clerkSignUp.password({
          emailAddress: email,
          password,
          firstName: displayName,
        });

        if (clerkErr) {
          setErrors([{ fieldId: "email", message: clerkErr.message }]);
          setOutcome({
            kind: "refused",
            code: "REGISTRATION_FAILED",
            message: clerkErr.message,
          });
          return;
        }

        if (clerkSignUp.status === "missing_requirements") {
          await clerkSignUp.verifications.sendEmailCode();
          setVerifyingEmail(true);
          setOutcome({ kind: "idle" });
          return;
        }

        if (clerkSignUp.status === "complete") {
          await clerkSignUp.finalize({
            navigate: ({ decorateUrl }) => {
              const url = decorateUrl("/profile");
              if (url.startsWith("http")) {
                window.location.href = url;
              } else {
                router.replace(url);
                router.refresh();
              }
            },
          });
          return;
        }
      } catch (err: unknown) {
        console.error("Clerk sign-up error", err);
      }
    }

    const result = (await callOperation<
      { next: "verify_email" | "profile" },
      IdentityOperationCode
    >(
      "/api/auth/sign-up",
      { displayName, email, password },
      "AUTH_UNAVAILABLE",
    )) as RegistrationResult;

    if (result.ok) {
      if (result.data.next === "profile") {
        router.replace("/profile");
        router.refresh();
        return;
      }
      router.push("/verify-email");
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

  const errorFor = (fieldId: string) => errors.find((error) => error.fieldId === fieldId)?.message;
  const submitting = outcome.kind === "submitting";

  if (verifyingEmail) {
    return (
      <form
        className="auth-form"
        noValidate
        onSubmit={handleVerifyCode}
        data-hydrated={hydrated ? "true" : "false"}
      >
        <ErrorSummary errors={errors} ref={summaryRef} />

        <UiStatus
          kind="restricted"
          heading="Check your email"
          message="We have sent a verification code to your email address. Enter it below to complete registration."
        />

        <FormField
          id="code"
          name="code"
          type="text"
          label="Verification code"
          hint="6-digit code sent to your email"
          required
          value={verificationCode}
          onChange={(e) => setVerificationCode(e.target.value)}
          error={errorFor("code")}
        />

        <button className="auth-form__submit" type="submit" disabled={submitting}>
          {submitting ? "Verifying…" : "Verify and complete"}
        </button>

        <p className="auth-form__links">
          <button
            type="button"
            className="button button--quiet"
            onClick={() => setVerifyingEmail(false)}
          >
            ← Back to sign up
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

      {outcome.kind === "refused" && errors.length === 0 ? (
        <UiStatus
          kind={outcome.code === "AUTH_UNAVAILABLE" ? "offline" : "error"}
          heading="No account was created"
          message={outcome.message}
        />
      ) : null}

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

      <div className="flex flex-col gap-3">
        <button className="auth-form__submit" type="submit" disabled={submitting}>
          {submitting ? "Creating your account…" : "Create account"}
        </button>

        <button
          type="button"
          className="button button--secondary w-full"
          onClick={handleGoogleSignUp}
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
