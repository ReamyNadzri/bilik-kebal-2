"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

type Navigate = (params: { decorateUrl: (url: string) => string }) => void | Promise<unknown>;

/**
 * The `navigate` callback Clerk's `finalize()` expects, going to `next`.
 *
 * `decorateUrl` may return an absolute URL (Safari's tracking prevention), and
 * that one has to be a full page load. `replace`, not `push`: going back to a
 * sign-in form that would now redirect away is a dead end in the history.
 */
export function useFinalizeNavigation(): (next: string) => Navigate {
  const router = useRouter();
  return useCallback(
    (next: string): Navigate =>
      ({ decorateUrl }) => {
        const url = decorateUrl(next);
        if (url.startsWith("http")) {
          window.location.href = url;
          return;
        }
        router.replace(url);
        router.refresh();
      },
    [router],
  );
}

/**
 * Brings the server's copy of the account up to date with Clerk now, rather
 * than when the webhook arrives (email just verified, account just created).
 * Best effort: the webhook converges on the same state.
 */
export async function syncClerkAccount(): Promise<void> {
  try {
    await fetch("/api/identity/clerk-sync", { method: "POST" });
  } catch {
    // The webhook will deliver the same change.
  }
}

const GOOGLE_PENDING_KEY = "vaultix_google_sign_in";
/** A Google round trip longer than this is not a return, it is a later visit. */
const GOOGLE_RETURN_WINDOW_MS = 10 * 60_000;

/** Marks that this tab is leaving for Google, so the return can be told apart from a visit. */
export function markGoogleSignInStarted(): void {
  try {
    window.sessionStorage.setItem(GOOGLE_PENDING_KEY, String(Date.now()));
  } catch {
    // Storage can be refused (private mode); the return is then not reported.
  }
}

/** True once, on the first sign-in render after a Google round trip in this tab. */
export function takeGoogleSignInReturn(): boolean {
  try {
    const startedAt = Number(window.sessionStorage.getItem(GOOGLE_PENDING_KEY));
    window.sessionStorage.removeItem(GOOGLE_PENDING_KEY);
    return startedAt > 0 && Date.now() - startedAt < GOOGLE_RETURN_WINDOW_MS;
  } catch {
    return false;
  }
}

/** How long a Google start may take before the form says it did not happen. */
export const GOOGLE_START_TIMEOUT_MS = 10_000;

/**
 * Resolves true if this page is left (for Google) within `ms`, else false.
 *
 * Clerk's `sso()` can finish without an error and without leaving: it reuses
 * a sign-in already open in the Clerk client instead of starting a Google one.
 * Nothing else would ever take the form off "Signing in…".
 */
export function leavesPageWithin(ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const onLeave = () => {
      window.clearTimeout(timer);
      resolve(true);
    };
    const timer = window.setTimeout(() => {
      window.removeEventListener("pagehide", onLeave);
      resolve(false);
    }, ms);
    window.addEventListener("pagehide", onLeave, { once: true });
  });
}
