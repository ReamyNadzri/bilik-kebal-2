/**
 * Idle sign-out (decided 2026-09-25). Sheriffs and the Owner are signed out
 * after 30 minutes without activity, with a warning 2 minutes before; members
 * after 7 days. The 7-day limit is also enforced by the proxy, so it holds
 * when no tab is open; the 30-minute limit is enforced in the browser, and the
 * 15-minute step-up still guards every sensitive Sheriff action.
 */
export const STAFF_IDLE_MS = 30 * 60_000;
export const MEMBER_IDLE_MS = 7 * 24 * 60 * 60_000;
export const IDLE_WARNING_MS = 2 * 60_000;

/** Shared between tabs, so activity in one keeps the others signed in. */
export const LAST_ACTIVITY_KEY = "vaultix.lastActivity";

/** The proxy's server-side record of the last request with a session. */
export const LAST_SEEN_COOKIE = "vaultix_last_seen";

export type IdlePhase = "active" | "warning" | "expired";

export function idlePhase(idleMs: number, limitMs: number, warns: boolean): IdlePhase {
  if (idleMs >= limitMs) return "expired";
  if (warns && idleMs >= limitMs - IDLE_WARNING_MS) return "warning";
  return "active";
}
