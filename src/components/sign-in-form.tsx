"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSignIn } from "@clerk/nextjs";
import { ErrorSummary, type FieldError } from "./error-summary";
import { FormField } from "./form-field";
import { GoogleIcon } from "./google-icon";
import { UiStatus } from "./ui-status";
import type { IdentityOperationCode } from "@/contracts";
import { useAuth } from "@/features/presentation/auth/auth-provider";
import { DEFAULT_SIGNED_IN_PATH } from "@/features/presentation/auth/redirect-target";
import { IDENTITY_MESSAGE } from "@/features/presentation/identity-messages";
import { useHydrated } from "@/features/presentation/use-hydrated";

type Outcome =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "refused"; code: IdentityOperationCode; message: string };

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
 * Sign-in, wired to the identity operation through the auth provider and Clerk.
 */
export function SignInForm({ next = DEFAULT_SIGNED_IN_PATH }: SignInFormProps) {
  const router = useRouter();
  const { signIn } = useAuth();
  const { signIn: clerkSignIn } = useSignIn();
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });
  const summaryRef = useRef<HTMLDivElement>(null);
  const hydrated = useHydrated();

  useEffect(() => {
    if (errors.length > 0) {
      summaryRef.current?.focus();
    }
  }, [errors]);

  async function handleGoogleSignIn() {
    if (!clerkSignIn) return;
    try {
      await clerkSignIn.sso({
        strategy: "oauth_google",
        redirectUrl: next,
        redirectCallbackUrl: "/sso-callback",
      });
    } catch (err: unknown) {
      console.error("Google SSO error", err);
    }
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

    setErrors([]);
    setOutcome({ kind: "submitting" });

    // Authenticate with Clerk when available
    if (clerkSignIn) {
      try {
        const { error: clerkErr } = await clerkSignIn.password({
          emailAddress: email,
          password,
        });

        if (clerkErr) {
          setErrors([{ fieldId: "password", message: clerkErr.message }]);
          setOutcome({
            kind: "refused",
            code: "INVALID_CREDENTIALS",
            message: clerkErr.message,
          });
          return;
        }

        if (clerkSignIn.status === "complete") {
          await clerkSignIn.finalize({
            navigate: ({ decorateUrl }) => {
              const url = decorateUrl(next);
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
        console.error("Clerk sign-in error", err);
      }
    }

    const result = await signIn({ email, password });

    if (result.ok) {
      /**
       * `replace` rather than `push`: going back to a sign-in form that would
       * now redirect away is a dead end in the history stack.
       */
      router.replace(next);
      router.refresh();
      return;
    }

    const fieldErrors = result.fieldErrors ?? {};
    const mapped = Object.entries(fieldErrors).flatMap(([fieldId, messages]) =>
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

  return (
    <form
      className="auth-form"
      noValidate
      onSubmit={handleSubmit}
      data-hydrated={hydrated ? "true" : "false"}
    >
      <ErrorSummary errors={errors} ref={summaryRef} />

      {outcome.kind === "refused" && outcome.code === "EMAIL_NOT_VERIFIED" ? (
        <UiStatus
          kind="restricted"
          heading="Confirm your email address first"
          message={outcome.message}
          action={<Link href="/verify-email">Resend the verification link</Link>}
        />
      ) : null}

      {outcome.kind === "refused" &&
      outcome.code !== "EMAIL_NOT_VERIFIED" &&
      errors.length === 0 ? (
        <UiStatus
          kind={outcome.code === "AUTH_UNAVAILABLE" ? "offline" : "error"}
          heading="You were not signed in"
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
          onClick={handleGoogleSignIn}
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
