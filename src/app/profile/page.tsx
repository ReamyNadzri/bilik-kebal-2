import type { Metadata } from "next";
import Link from "next/link";
import { AccountSummary } from "@/components/account-summary";
import { UiStatus } from "@/components/ui-status";
import type { AccountViewModel } from "@/contracts";
import { loadAccountViewModel } from "@/modules/identity";

export const metadata: Metadata = {
  title: "Profile | VAULTIX",
};

/**
 * User-specific data must never enter a shared cache
 * (context/code-standards.md), and the loader reads the request's session, so
 * this page is rendered per request rather than prerendered.
 */
export const dynamic = "force-dynamic";

type Outcome =
  | { kind: "account"; account: AccountViewModel }
  | { kind: "unauthenticated" }
  | { kind: "unavailable" };

/**
 * Reads the account through the Codex-published loader.
 *
 * The loader answers `null` for a request it cannot attribute to a signed-in
 * user, and throws when identity itself is unreachable — a missing Supabase
 * configuration or a failed round trip. Those are different situations for the
 * reader: one is "sign in", the other is "this is our fault, try again". They
 * are separated here rather than collapsed into a single failure.
 */
async function readAccount(): Promise<Outcome> {
  try {
    const account = await loadAccountViewModel();

    return account === null ? { kind: "unauthenticated" } : { kind: "account", account };
  } catch {
    // Deliberately swallowed: the reason belongs in server logs, never in a
    // page that could surface provider detail to a browser
    // (context/code-standards.md, error boundaries).
    return { kind: "unavailable" };
  }
}

export default async function ProfilePage() {
  const outcome = await readAccount();

  return (
    <>
      <h1>Profile</h1>

      {outcome.kind === "unauthenticated" ? (
        <UiStatus
          kind="restricted"
          heading="Sign in to see your account"
          message="Your verification states and what this account can do are only visible once you are signed in."
          action={<Link href="/sign-in">Sign in</Link>}
        />
      ) : null}

      {outcome.kind === "unavailable" ? (
        <UiStatus
          kind="offline"
          heading="Your account could not be loaded"
          message="Accounts are unavailable right now. This is not a problem with your account. Try again shortly."
          action={<Link href="/profile">Try again</Link>}
        />
      ) : null}

      {outcome.kind === "account" ? <AccountSummary account={outcome.account} /> : null}
    </>
  );
}
