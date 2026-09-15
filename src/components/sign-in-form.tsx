"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ErrorSummary, type FieldError } from "./error-summary";
import { FormField } from "./form-field";
import { UiStatus } from "./ui-status";
import type { IdentityOperationCode, SignInResult } from "@/contracts";
import { callOperation } from "@/features/presentation/call-operation";
import { IDENTITY_MESSAGE } from "@/features/presentation/identity-messages";
import { useHydrated } from "@/features/presentation/use-hydrated";

type Outcome =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "refused"; code: IdentityOperationCode; message: string };

/**
 * Sign-in, wired to POST /api/auth/sign-in.
 *
 * Presence checks stay in the client for fast feedback, but they decide
 * nothing: the operation re-validates and is the only thing that can
 * authenticate. Field errors come from the operation's fieldErrors so the
 * wording a user reads matches the decision that was actually made.
 */
export function SignInForm() {
  const router = useRouter();
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

    const result = await callOperation<{ next: "profile" }, IdentityOperationCode>(
      "/api/auth/sign-in",
      { email, password },
      "AUTH_UNAVAILABLE",
    ).then((value) => value as SignInResult);

    if (result.ok) {
      router.push("/profile");
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

      <button className="auth-form__submit" type="submit" disabled={submitting}>
        {submitting ? "Signing in…" : "Sign in"}
      </button>

      {submitting ? <UiStatus kind="loading" heading="Checking your details" /> : null}

      <p className="auth-form__links">
        <Link href="/recover">Forgot your password?</Link>
        <Link href="/sign-up">Create an account</Link>
      </p>
    </form>
  );
}
