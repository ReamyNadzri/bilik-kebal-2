import type { Metadata } from "next";
import Link from "next/link";
import { AccountSummary } from "@/components/account-summary";
import { ProfileEditor } from "@/components/profile-editor";
import { ProfileWantedGrid } from "@/components/profile-wanted-grid";
import { UiStatus } from "@/components/ui-status";
import { marketplaceNow } from "@/features/marketplace/wanted-source";
import { requireAccount } from "@/features/presentation/auth/require-account";
import { readPublicProfile } from "@/modules/profiles/loaders/profile-operations";

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
   * identity service is reported in place instead.
   */
  const outcome = await requireAccount("/profile");

  if (outcome.kind !== "account") {
    return (
      <div className="page-bare profile-container">
        <div className="panel">
          <UiStatus
            kind="offline"
            heading="Your account could not be loaded"
            message="Accounts are unavailable right now. This is not a problem with your account. Try again shortly."
            action={<Link href="/profile">Try again</Link>}
          />
        </div>
      </div>
    );
  }

  const account = outcome.account;
  // The member's own public card (bio, posted requests) comes from the same
  // read anyone else sees, so what they edit is exactly what others see.
  const publicProfile = account.publicId ? await readPublicProfile(account.publicId) : null;
  const profile = publicProfile?.ok ? publicProfile.data : null;

  return (
    <div className="page-bare profile-container">
      <ProfileEditor
        account={account}
        bio={profile?.bio ?? null}
        postedCount={profile?.wanted.length ?? 0}
      />

      <ProfileWantedGrid
        heading="Your requests"
        wanted={profile?.wanted ?? []}
        now={marketplaceNow()}
        empty={
          <UiStatus
            kind="empty"
            heading="You have not posted a request yet"
            message="Ask for a resource, report a missing item or start a discussion."
            action={<Link href="/wanted/new">Post a Wanted</Link>}
          />
        }
      />

      <div className="panel profile-panel">
        <AccountSummary account={account} />
      </div>
    </div>
  );
}
