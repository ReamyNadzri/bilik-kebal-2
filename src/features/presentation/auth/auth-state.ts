import type { AccountViewModel } from "@/contracts";
import type { AccountCapabilities } from "@/features/presentation/account-capabilities";

/**
 * Whether the viewer's account is known yet, and what it turned out to be.
 *
 * `loading` exists for the round trips that happen after first paint — a
 * refresh, a sign-in, a re-check after a rejected operation. It is not the
 * state a screen starts in: the server already knows who is asking, so the
 * provider is seeded with the answer and a protected screen never renders
 * itself twice or flashes content it then has to take away.
 */
export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

/** What the viewer may currently do, as decided by the identity module. */
export type AccountCapability = keyof AccountCapabilities;

export interface AuthState {
  /**
   * The published account view model, never a locally assembled one.
   *
   * `null` whenever the viewer is not authenticated, and also while a refresh
   * is in flight after the session turned out to be gone.
   */
  readonly account: AccountViewModel | null;
  readonly status: AuthStatus;
  /** Plain-English wording for the last failure, or `null`. */
  readonly error: string | null;
}

export const INITIAL_AUTH_STATE: AuthState = {
  account: null,
  status: "loading",
  error: null,
};

export function authStateFor(account: AccountViewModel | null): AuthState {
  return {
    account,
    status: account === null ? "unauthenticated" : "authenticated",
    error: null,
  };
}

/**
 * Whether the account holds a capability.
 *
 * Reads the booleans the identity access policy already decided and published.
 * Presentation must never recompute a capability from a trust state, because
 * two implementations of one rule eventually disagree and the browser's copy
 * is the one that cannot be trusted
 * (src/features/presentation/account-capabilities.ts).
 */
export function can(state: AuthState, capability: AccountCapability): boolean {
  return state.account?.capabilities[capability] === true;
}

/**
 * Whether the account is one the Sheriff console will admit.
 *
 * This is the backend's navigation-only flag. It decides whether a link and a
 * console shell are worth rendering; it decides nothing about what the console
 * will actually return. Role and institution scope are enforced server-side
 * and repeated by RLS on every operation (context/architecture.md).
 *
 * There is deliberately no `hasRole` here. The identity contract publishes no
 * role to the browser, and inventing a frontend role model would fork a
 * backend-owned domain type
 * (docs/superpowers/plans/2026-09-13-vaultix-mvp-coordination.md).
 */
export function hasConsoleAccess(state: AuthState): boolean {
  return state.account?.console.hasAccess === true;
}

/** Whether the account has been restricted by a Sheriff or Owner. */
export function isRestricted(state: AuthState): boolean {
  return state.account?.trust.restricted === true;
}
