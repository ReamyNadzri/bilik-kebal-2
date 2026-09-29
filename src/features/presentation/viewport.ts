"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * The shell's three layouts (design_handoff_vaultix_mobile).
 *
 * Layout itself is decided in CSS, so the server renders every width
 * correctly; these queries are the same breakpoints for the few behaviours
 * that need script — page swipes and the swipe hint on a phone, and closing the
 * compact menu when the window widens to the desktop rail. Keep them in step
 * with the media queries in globals.css.
 *
 * - Mobile: below 720 px — compact header, bottom tab bar, swipes.
 * - Tablet: 720 to 1199 px — compact header and the drop-down menu.
 * - Desktop: 1200 px and up — the full rail.
 */
export const MOBILE_QUERY = "(max-width: 44.9375rem)";
export const COMPACT_QUERY = "(max-width: 74.9375rem)";

const noMatchOnServer = () => false;

/**
 * Whether a media query matches, kept current as the window changes.
 *
 * The server has no viewport, so it answers no; the first client render
 * agrees, and the real answer follows straight after hydration.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window.matchMedia !== "function") return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  const read = useCallback(
    () => typeof window.matchMedia === "function" && window.matchMedia(query).matches,
    [query],
  );
  return useSyncExternalStore(subscribe, read, noMatchOnServer);
}
