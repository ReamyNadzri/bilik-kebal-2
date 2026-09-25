import type { Metadata } from "next";
import Link from "next/link";
import { ProfileSettings } from "@/components/profile-settings";
import { ProfileWantedGrid } from "@/components/profile-wanted-grid";
import { UiStatus } from "@/components/ui-status";
import { marketplaceNow } from "@/features/marketplace/wanted-source";
import { requireAccount } from "@/features/presentation/auth/require-account";
import { readPublicProfile } from "@/modules/profiles/loaders/profile-operations";
import { listOwnTaxonomyRequests } from "@/modules/taxonomy-requests/loaders/taxonomy-request-operations";
import { readFreeAllowance } from "@/modules/wanted/loaders/wanted-operations";

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
  const [publicProfile, allowance, entryRequests] = await Promise.all([
    account.publicId ? readPublicProfile(account.publicId) : Promise.resolve(null),
    readFreeAllowance(),
    listOwnTaxonomyRequests(),
  ]);
  const profile = publicProfile?.ok ? publicProfile.data : null;

  return (
    <div className="page-bare profile-container">
      <header className="panel page-heading">
        <div>
          <h1>Profile</h1>
          <p className="page-heading__lede">
            Your requests first, then your details, verification and free requests.
          </p>
        </div>
        <Link className="button button--primary" href="/wanted/new">
          Post a Wanted <span aria-hidden="true">→</span>
        </Link>
      </header>

      {/* The member's own requests lead the page; settings follow. */}
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

      <ProfileSettings
        account={account}
        bio={profile?.bio ?? null}
        allowance={allowance.ok ? allowance.data : null}
        entryRequests={entryRequests.ok ? entryRequests.data : null}
      />
    </div>
  );
}
