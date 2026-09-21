import type { Metadata } from "next";
import Link from "next/link";
import { AccountSummary } from "@/components/account-summary";
import { FixtureNotice } from "@/components/fixture-notice";
import { ProfileStudio } from "@/components/profile-studio";
import { UiStatus } from "@/components/ui-status";
import type { AccountViewModel } from "@/contracts";
import { loadAccountViewModel } from "@/modules/identity";

export const metadata: Metadata = {
  title: "Profile | VAULTIX",
};

export const dynamic = "force-dynamic";

type Outcome =
  | { kind: "account"; account: AccountViewModel }
  | { kind: "unauthenticated" }
  | { kind: "unavailable" };

async function readAccount(): Promise<Outcome> {
  try {
    const account = await loadAccountViewModel();

    return account === null ? { kind: "unauthenticated" } : { kind: "account", account };
  } catch {
    return { kind: "unavailable" };
  }
}

export default async function ProfilePage() {
  const outcome = await readAccount();

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

      {outcome.kind === "unauthenticated" ? (
        <div className="panel">
          <UiStatus
            kind="restricted"
            heading="Sign in to see your account"
            message="Your verification states and what this account can do are only visible once you are signed in."
            action={<Link href="/sign-in">Sign in</Link>}
          />
        </div>
      ) : null}

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
