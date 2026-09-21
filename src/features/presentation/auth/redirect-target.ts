import { safeNextPath } from "@/modules/identity/delivery/auth-http";

/**
 * The query parameter carrying where the viewer was heading.
 *
 * `next` rather than `redirect`, because the email confirmation callback
 * already speaks that name (src/app/auth/callback/route.ts) and one vocabulary
 * for "where to go once identity is settled" is worth more than matching any
 * particular convention.
 */
export const NEXT_PARAM = "next";

/** Where a viewer lands when nothing better was requested. */
export const DEFAULT_SIGNED_IN_PATH = "/profile";

export const SIGN_IN_PATH = "/sign-in";

export const FORBIDDEN_PATH = "/forbidden";

/**
 * Routes that exist to get a viewer signed in.
 *
 * A session failure on one of these must never bounce anywhere: the viewer is
 * already where they need to be, and redirecting would be the loop.
 */
const GUEST_PATHS: readonly string[] = [SIGN_IN_PATH, "/sign-up", "/recover", "/verify-email"];

export function isGuestPath(pathname: string): boolean {
  return GUEST_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * Reads a requested destination, refusing anything that leaves this origin.
 *
 * Validation is delegated to the identity module's `safeNextPath` rather than
 * repeated here. An open redirect on a sign-in screen is a credential
 * phishing route, and it is worth exactly one implementation.
 */
export function readNextPath(
  candidate: string | string[] | null | undefined,
  fallback: string = DEFAULT_SIGNED_IN_PATH,
): string {
  const value = Array.isArray(candidate) ? candidate[0] : candidate;

  return safeNextPath(value ?? null, fallback);
}

/**
 * The sign-in URL that returns the viewer to `from` afterwards.
 *
 * A guest path is never preserved: sending someone back to the sign-in screen
 * they just completed is a loop dressed up as a courtesy.
 */
export function signInPathFor(from: string): string {
  if (from === "" || isGuestPath(from)) {
    return SIGN_IN_PATH;
  }

  const target = safeNextPath(from, "");

  return target === ""
    ? SIGN_IN_PATH
    : `${SIGN_IN_PATH}?${NEXT_PARAM}=${encodeURIComponent(target)}`;
}
