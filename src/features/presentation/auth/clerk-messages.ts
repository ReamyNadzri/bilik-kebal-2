/**
 * Plain-English copy for Clerk refusals.
 *
 * Clerk's own messages are written for developers as often as for people, and
 * some would say whether an address has an account. Sign-in and recovery must
 * not, so every "no such account" answer reads the same as a wrong password.
 */
export interface ClerkErrorLike {
  readonly code: string;
  readonly message?: string;
  readonly longMessage?: string | undefined;
}

const MESSAGES: Readonly<Record<string, string>> = {
  form_password_incorrect: "The email address or password is not correct.",
  form_identifier_not_found: "The email address or password is not correct.",
  form_password_validation_failed: "The email address or password is not correct.",
  strategy_for_user_invalid: "The email address or password is not correct.",
  form_code_incorrect: "That code is not correct. Check the email and try again.",
  verification_expired: "That code has expired. Send a new one.",
  verification_failed: "That code could not be checked. Send a new one.",
  form_identifier_exists: "An account already uses this email address. Sign in instead.",
  form_password_pwned:
    "This password has appeared in a data breach elsewhere. Choose a different password.",
  form_password_length_too_short: "Use a password of at least 12 characters.",
  form_password_not_strong_enough: "Choose a stronger password.",
  form_param_format_invalid: "Check the details you entered.",
  too_many_requests: "Too many attempts. Wait a few minutes, then try again.",
  user_locked: "This account is locked after too many attempts. Try again later.",
};

export const CLERK_UNAVAILABLE_MESSAGE =
  "Sign-in is unavailable right now. Check your connection and try again.";

export function clerkMessage(error: ClerkErrorLike | null | undefined): string {
  if (!error) return CLERK_UNAVAILABLE_MESSAGE;
  return MESSAGES[error.code] ?? error.longMessage ?? error.message ?? CLERK_UNAVAILABLE_MESSAGE;
}

/** Which form field a Clerk refusal belongs to, if any. */
export function clerkErrorField(error: ClerkErrorLike): "email" | "password" | "code" | null {
  if (error.code.startsWith("form_code") || error.code.startsWith("verification_")) return "code";
  if (error.code === "form_identifier_exists" || error.code === "form_param_format_invalid")
    return "email";
  if (error.code.startsWith("form_password")) return "password";
  return null;
}
