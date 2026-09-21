import type { Metadata } from "next";
import Link from "next/link";
import { AccountSummary } from "@/components/account-summary";
import { FixtureNotice } from "@/components/fixture-notice";
import { ProfileStudio } from "@/components/profile-studio";
import { UiStatus } from "@/components/ui-status";
import { requireAccount } from "@/features/presentation/auth/require-account";

export const metadata: Metadata = {
  title: "Profile | VAULTIX",
};

/**
 * User-specific data must never enter a shared cache
 * (context/code-standards.md), and the guard reads the request's session, so
 * this page is rendered per request rather than prerendered.
 */
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  /**
   * Protected: an unauthenticated viewer is redirected to sign in and returned
   * here afterwards, before any of this page is rendered. An unreachable
   * identity service is reported in place instead — it is not the viewer's
   * problem to solve by signing in again.
   */
  const outcome = await requireAccount("/profile");

  return (
    <div className="page-bare profile-container">
      <div className="panel page-heading">
        <div>
          <h1>Profile</h1>
          <p className="page-heading__lede">
            Check your account trust state, and customize your hunter licence identity.
          </p>
        </div>
      </div>

      {/*
        No signed-out branch: the guard redirects that viewer to sign in before
        this page renders, and returns them here afterwards. An unreachable
        identity service is a different matter and is reported in place.
      */}
      {outcome.kind === "unavailable" ? (
        <div className="panel">
          <UiStatus
            kind="offline"
            heading="Your account could not be loaded"
            message="Accounts are unavailable right now. This is not a problem with your account. Try again shortly."
            action={<Link href="/profile">Try again</Link>}
          />
        </div>
      ) : null}

      {outcome.kind === "account" ? (
        <div className="panel profile-panel">
          <AccountSummary account={outcome.account} />
        </div>
      ) : null}

      <div className="panel profile-studio-panel">
        <FixtureNotice screen="The hunter licence editor" />
        <ProfileStudio />
      </div>
    </div>
  );
}
