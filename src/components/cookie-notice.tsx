"use client";

import { useState } from "react";
import { useHydrated } from "@/features/presentation/use-hydrated";

const DISMISSED_KEY = "vaultix.cookieNotice";

/** What VAULTIX keeps in the browser, in one sentence. Shared by the bar and the footer. */
export const COOKIE_SUMMARY =
  "VAULTIX uses only essential cookies: one keeps you signed in and one remembers the university you chose. Your sound, motion and swipe settings stay in your browser. No advertising or tracking cookies.";

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "ok";
  } catch {
    return false;
  }
}

/**
 * The cookie information at the bottom of the screen, shown until the visitor
 * presses OK. Informational, not a consent wall: every cookie VAULTIX sets is
 * essential or a remembered preference, and nothing tracks the visitor.
 *
 * The dismissal is remembered in this browser only; if storage is blocked the
 * notice simply shows again next visit. It sits above the phone tab bar, and
 * the footer repeats the same words for anyone who dismissed it.
 */
export function CookieNotice() {
  // Shown only once hydrated, so the server render and the first client render agree.
  const hydrated = useHydrated();
  const [dismissed, setDismissed] = useState(false);

  if (!hydrated || dismissed || readDismissed()) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISSED_KEY, "ok");
    } catch {
      // Remembering is a convenience; the notice hides for this visit anyway.
    }
    setDismissed(true);
  }

  return (
    <section className="cookie-notice" aria-label="Cookies">
      <p className="cookie-notice__text">{COOKIE_SUMMARY}</p>
      <button type="button" className="button button--brass button--compact" onClick={dismiss}>
        OK
      </button>
    </section>
  );
}
