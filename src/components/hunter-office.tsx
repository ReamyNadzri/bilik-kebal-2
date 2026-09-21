import Image from "next/image";
import type { AccountViewModel } from "@/contracts";
import type { ClaimStatus, ClaimSummary } from "@/features/marketplace/types";

export interface HunterOfficeProps {
  /** The viewer's claims, or `null` when they could not be read. */
  readonly claims: readonly ClaimSummary[] | null;
  /** The signed-in user's account details, or null when signed out. */
  readonly account?: AccountViewModel | null;
}

const IN_REVIEW: readonly ClaimStatus[] = ["screening", "needs-information", "under-review"];

/**
 * The Hunter's Office masthead on the Hunt workspace.
 *
 * Displays the authenticated hunter's profile and live summary of their claims.
 */
export function HunterOffice({ claims, account }: HunterOfficeProps) {
  const stats =
    claims === null
      ? null
      : [
          { label: "Claims", value: claims.length },
          {
            label: "In review",
            value: claims.filter((claim) => IN_REVIEW.includes(claim.status)).length,
          },
          {
            label: "Approved",
            value: claims.filter((claim) => claim.status === "approved").length,
          },
          {
            label: "Not selected",
            value: claims.filter((claim) => claim.status === "not-selected").length,
          },
        ];

  const displayName = account?.displayName ?? null;
  const institution = account?.institution?.name ?? "Academic Hunter";
  const isVerified = account?.trust.institution === "verified";

  return (
    <section className="hunt-office panel" aria-labelledby="hunt-office-title">
      <div className="hunt-office__row">
        <Image
          className="hunt-office__avatar avatar avatar--tone-medium"
          src="/brand/avatar-1.webp"
          alt="Hunter avatar"
          width={76}
          height={76}
          unoptimized
        />
        <div className="hunt-office__intro">
          <p className="pixel-label">
            {displayName ? `${displayName} · ${institution}` : "Hunter’s Office"}
            {isVerified ? " · ★ Verified" : ""}
          </p>
          <h1 id="hunt-office-title">
            {displayName ? `Welcome back, ${displayName}` : "Take a hunt, claim the bounty"}
          </h1>
          <p className="hunt-office__lede">
            Pick up an open request, submit a resource you are authorised to share, and follow it
            through Sheriff review.
          </p>
        </div>
        {stats === null ? null : (
          <dl className="hunt-stats" aria-label="Your claims at a glance">
            {stats.map((stat) => (
              <div className="hunt-stats__cell" key={stat.label}>
                <dt>{stat.label}</dt>
                <dd className="numeric">{stat.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}
