import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProfileHeader } from "@/components/profile-header";
import { ProfileWantedGrid } from "@/components/profile-wanted-grid";
import { UiStatus } from "@/components/ui-status";
import { formatRinggit, sen } from "@/features/marketplace/money";
import { marketplaceNow } from "@/features/marketplace/wanted-source";
import { readPublicProfile } from "@/modules/profiles/loaders/profile-operations";

export const metadata: Metadata = {
  title: "Member | VAULTIX",
};

/** Reads the viewer's session to decide what they may see; never cached. */
export const dynamic = "force-dynamic";

interface MemberPageProps {
  readonly params: Promise<{ publicId: string }>;
}

/**
 * A member's public profile: picture, name, badges, joined date, bio and the
 * Wanteds they posted, with their bounties. Nothing private: no email,
 * verification evidence, claims or who backed what
 * (context/progress-tracker.md, 2026-09-24 decision).
 */
export default async function MemberPage({ params }: MemberPageProps) {
  const { publicId } = await params;
  const result = await readPublicProfile(publicId);

  if (!result.ok) {
    if (result.code === "PROFILE_NOT_FOUND") notFound();
    return (
      <div className="panel">
        {result.code === "AUTH_REQUIRED" ? (
          <UiStatus
            kind="restricted"
            heading="Sign in to view member profiles"
            message="Profiles are visible to signed-in members with a verified email."
            action={<Link href={`/sign-in?next=/u/${encodeURIComponent(publicId)}`}>Sign in</Link>}
          />
        ) : result.code === "EMAIL_NOT_VERIFIED" ? (
          <UiStatus
            kind="restricted"
            heading="Verify your email to view member profiles"
            message="Browsing needs a verified email address and nothing more."
            action={<Link href="/verify-email">Go to email verification</Link>}
          />
        ) : (
          <UiStatus
            kind="offline"
            heading="This profile could not be loaded"
            message="Profiles are temporarily unavailable. Nothing has changed. Try again shortly."
            action={<Link href={`/u/${encodeURIComponent(publicId)}`}>Try again</Link>}
          />
        )}
      </div>
    );
  }

  const profile = result.data;
  const open = profile.wanted.filter(
    (item) => item.status !== "closed" && item.status !== "reviewing",
  ).length;
  const totalBounty = sen(profile.wanted.reduce((total, item) => total + item.grossBountySen, 0));

  return (
    <div className="page-bare profile-container">
      <ProfileHeader
        displayName={profile.displayName}
        avatarUrl={profile.avatarUrl}
        bio={profile.bio}
        joinedAt={profile.joinedAt}
        institutionName={profile.institutionName}
        institutionVerified={profile.institutionVerified}
        stats={[
          { label: "Requests", value: String(profile.wanted.length) },
          { label: "Open", value: String(open) },
          { label: "Bounties posted", value: formatRinggit(totalBounty) },
        ]}
      />
      <ProfileWantedGrid
        heading={`Requests by ${profile.displayName}`}
        wanted={profile.wanted}
        now={marketplaceNow()}
        empty={
          <UiStatus
            kind="empty"
            heading="No requests yet"
            message={`${profile.displayName} has not posted a request.`}
          />
        }
      />
    </div>
  );
}
