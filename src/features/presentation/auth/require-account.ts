import { redirect } from "next/navigation";
import type { AccountViewModel } from "@/contracts";
import { loadAccountViewModel } from "@/modules/identity";
import type { AccountCapability } from "./auth-state";
import { FORBIDDEN_PATH, signInPathFor } from "./redirect-target";

/**
 * Route guards for Server Components.
 *
 * These are the guards that matter for the "no flash" requirement: a redirect
 * decided here happens before a byte of the protected page is rendered, so
 * there is nothing to withdraw and nothing to hide.
 *
 * They are not access control. Every operation behind these screens
 * authenticates and authorises again on the server and is repeated by RLS;
 * refusing to render a page is a courtesy to the reader, not a security
 * boundary (context/architecture.md).
 */

export type AccountOutcome =
  | { readonly kind: "account"; readonly account: AccountViewModel }
  | { readonly kind: "unauthenticated" }
  | { readonly kind: "unavailable" };

/**
 * Reads the account, separating "nobody is signed in" from "identity is down".
 *
 * The loader answers `null` for a request it cannot attribute to a signed-in
 * user and throws when identity itself is unreachable. Those are different
 * situations for the reader — one is "sign in", the other is "this is our
 * fault" — so they are never collapsed into one failure.
 */
export async function readAccount(): Promise<AccountOutcome> {
  try {
    const account = await loadAccountViewModel();

    return account === null ? { kind: "unauthenticated" } : { account, kind: "account" };
  } catch {
    // Deliberately swallowed: the reason belongs in server logs, never in a
    // page that could surface provider detail to a browser
    // (context/code-standards.md, error boundaries).
    return { kind: "unavailable" };
  }
}

/**
 * Sends an unauthenticated viewer to sign in, remembering where they were.
 *
 * An unreachable identity service is deliberately *not* redirected. Bouncing
 * an outage to the sign-in screen would send every visitor to a form that
 * cannot work either, and they would arrive with no idea why. The caller gets
 * `unavailable` back and says so in place.
 */
export async function requireAccount(
  currentPath: string,
): Promise<
  | { readonly kind: "account"; readonly account: AccountViewModel }
  | { readonly kind: "unavailable" }
> {
  const outcome = await readAccount();

  if (outcome.kind === "unauthenticated") {
    redirect(signInPathFor(currentPath));
  }

  return outcome;
}

/**
 * Additionally refuses an account that lacks a published capability.
 *
 * The capability is the identity module's decision, read as published. A
 * viewer who is signed in but not yet institution verified is told what is
 * missing rather than asked to sign in again — they already are.
 */
export async function requireCapability(
  currentPath: string,
  capability: AccountCapability,
): Promise<
  | { readonly kind: "account"; readonly account: AccountViewModel }
  | { readonly kind: "unavailable" }
> {
  const outcome = await requireAccount(currentPath);

  if (outcome.kind === "account" && !outcome.account.capabilities[capability]) {
    redirect(FORBIDDEN_PATH);
  }

  return outcome;
}

/**
 * Keeps a signed-in viewer off the screens that exist to sign someone in.
 *
 * An outage leaves the screen alone: if identity cannot be read, the viewer
 * may well need this form, and refusing to render it would strand them.
 */
export async function requireGuest(destination: string): Promise<void> {
  const outcome = await readAccount();

  if (outcome.kind === "account") {
    redirect(destination);
  }
}
