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
  form_identifier_not_found_or_password_incorrect: "The email address or password is not correct.",
  identifier_not_found: "The email address or password is not correct.",
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
  oauth_access_denied: "Google sign-in was cancelled. Try again, or sign in with your password.",
  external_account_exists: "This Google account is already linked to a different VAULTIX account.",
  identifier_already_signed_in: "You are already signed in on this device.",
  session_exists: "You are already signed in on this device.",
  not_allowed_access: "This account cannot sign in. Contact VAULTIX support.",
  external_account_email_address_verification_required:
    "Google did not confirm this email address. Sign in with your password instead.",
  user_locked: "This account is locked after too many attempts. Try again later.",
};

export const CLERK_UNAVAILABLE_MESSAGE =
  "Sign-in is unavailable right now. Check your connection and try again.";

/**
 * The Clerk error that decided the refusal.
 *
 * Clerk wraps API refusals: the outer error carries a generic code and the
 * specific one (`form_identifier_not_found`, …) sits in `errors[0]`. Resource
 * methods throw that shape instead of returning it. Anything else thrown
 * (a network failure, a bug) is treated as unavailable, never shown raw.
 */
export function toClerkError(error: unknown): ClerkErrorLike | null {
  if (typeof error !== "object" || error === null) return null;
  const nested = (error as { errors?: unknown }).errors;
  if (Array.isArray(nested) && nested[0] && typeof nested[0].code === "string") {
    const inner = nested[0] as {
      code: string;
      message?: string;
      longMessage?: string;
      long_message?: string;
    };
    return {
      code: inner.code,
      ...(inner.message ? { message: inner.message } : {}),
      longMessage: inner.longMessage ?? inner.long_message,
    };
  }
  const code = (error as { code?: unknown }).code;
  if (typeof code !== "string") return null;
  const { message, longMessage } = error as { message?: string; longMessage?: string };
  return { code, ...(message ? { message } : {}), longMessage };
}

export function clerkMessage(error: unknown): string {
  const clerkError = toClerkError(error);
  if (!clerkError) return CLERK_UNAVAILABLE_MESSAGE;
  return (
    MESSAGES[clerkError.code] ??
    clerkError.longMessage ??
    clerkError.message ??
    CLERK_UNAVAILABLE_MESSAGE
  );
}

/** Which form field a Clerk refusal belongs to, if any. */
export function clerkErrorField(error: unknown): "email" | "password" | "code" | null {
  const clerkError = toClerkError(error);
  if (!clerkError) return null;
  return fieldForCode(clerkError);
}

function fieldForCode(error: ClerkErrorLike): "email" | "password" | "code" | null {
  if (error.code.startsWith("form_code") || error.code.startsWith("verification_")) return "code";
  if (error.code === "form_identifier_exists" || error.code === "form_param_format_invalid")
    return "email";
  if (error.code.startsWith("form_password")) return "password";
  return null;
}
