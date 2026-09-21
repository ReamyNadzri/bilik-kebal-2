import Image from "next/image";
import type { ClaimStatus, ClaimSummary } from "@/features/marketplace/types";

export interface HunterOfficeProps {
  /** The viewer's claims, or `null` when they could not be read. */
  readonly claims: readonly ClaimSummary[] | null;
}

const IN_REVIEW: readonly ClaimStatus[] = ["screening", "needs-information", "under-review"];

/**
 * The Hunter's Office masthead on the Hunt workspace.
 *
 * The handoff shows claims won, net earned and a win rate. Earnings and rates
 * are money and judgement no operation produces, so the figures here are only
 * counts of the claim list the page was given
 * (docs/superpowers/specs/2026-09-16-vaultix-frontier-visual-handoff.md §6).
 * When that list could not be read, no figure is shown at all rather than a
 * row of zeros that would read as a Hunter with no history.
 *
 * The portrait is decorative and fixture: no operation yet returns the
 * viewer's chosen avatar.
 */
export function HunterOffice({ claims }: HunterOfficeProps) {
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

  return (
    <section className="hunt-office" aria-labelledby="hunt-office-title">
      <div className="hunt-office__cover">
        <span className="hunt-office__cover-tag">Hunter&rsquo;s Office</span>
      </div>
      <div className="hunt-office__main">
        <div className="hunt-office__avatar-wrap">
          <Image
            className="hunt-office__avatar avatar avatar--tone-medium"
            src="/brand/avatar-1.webp"
            alt="Hunter avatar"
            width={100}
            height={100}
            unoptimized
          />
        </div>
        <div className="hunt-office__body">
          <div className="hunt-office__intro">
            <p className="pixel-label pixel-label--on-dark">Frontier Workspace</p>
            <h1 id="hunt-office-title">Take a hunt, claim the bounty</h1>
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
      </div>
    </section>
  );
}
