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
