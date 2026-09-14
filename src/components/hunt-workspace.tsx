import Link from "next/link";
import { BountyPlate } from "./bounty-plate";
import { StatusStamp } from "./status-stamp";
import { UiStatus } from "./ui-status";
import { claimStatusPresentation, wantedStatusPresentation } from "@/features/marketplace/status";
import { formatClosing, formatSubmittedAge } from "@/features/marketplace/time";
import type { ClaimSummary, HuntOpportunity } from "@/features/marketplace/types";

export interface HuntWorkspaceProps {
  readonly hunts: readonly HuntOpportunity[];
  readonly claims: readonly ClaimSummary[];
  readonly now: string;
}

const ELIGIBILITY = {
  "institution-verified": "Institution verified students",
  "faculty-match-preferred": "Institution verified; faculty match preferred",
} as const;

function competition(count: number): string {
  return `${count} active ${count === 1 ? "claim" : "claims"} competing`;
}

function HuntCard({ hunt, now }: { readonly hunt: HuntOpportunity; readonly now: string }) {
  const closing = formatClosing(hunt.closesAt, now);

  return (
    <li className="hunt-card">
      <article aria-labelledby={`hunt-${hunt.id}`}>
        <div className="hunt-card__head">
          <p className="hunt-card__course">
            <strong>{hunt.courseCode}</strong>
            <span>{hunt.courseName}</span>
          </p>
          <StatusStamp presentation={wantedStatusPresentation(hunt.status)} context="Hunt" />
        </div>
        <h3 id={`hunt-${hunt.id}`}>{hunt.title}</h3>
        <p className="hunt-card__resource">{hunt.resourceType}</p>
        <BountyPlate amountSen={hunt.grossBountySen} />
        <dl className="index-grid hunt-card__facts" role="group" aria-label="Hunt details">
          <dt>Deadline</dt>
          <dd>
            <time dateTime={hunt.closesAt}>{closing.label}</time>
          </dd>
          <dt>Competition</dt>
          <dd>{competition(hunt.activeClaimCount)}</dd>
          <dt>Eligibility</dt>
          <dd>{ELIGIBILITY[hunt.eligibility]}</dd>
        </dl>
        <Link
          className="wanted-card__action"
          href={`/wanted/${hunt.id}`}
          aria-label={`View hunt: ${hunt.title}`}
        >
          View hunt
        </Link>
      </article>
    </li>
  );
}

function ClaimCard({ claim, now }: { readonly claim: ClaimSummary; readonly now: string }) {
  const presentation = claimStatusPresentation(claim.status);

  return (
    <li className="claim-card">
      <article aria-labelledby={`claim-${claim.id}`}>
        <div className="claim-card__head">
          <p className="claim-card__course">
            <strong>{claim.courseCode}</strong> {claim.courseName}
          </p>
          <StatusStamp presentation={presentation} context="Claim" />
        </div>
        <h3 id={`claim-${claim.id}`}>{claim.wantedTitle}</h3>
        <p className="claim-card__next">{presentation.nextStep}</p>
        <div className="claim-card__foot">
          <p>
            {claim.submittedAt === null ? (
              "Not submitted"
            ) : (
              <time dateTime={claim.submittedAt}>{formatSubmittedAge(claim.submittedAt, now)}</time>
            )}
          </p>
          <Link href={`/wanted/${claim.wantedId}`} aria-label={`View Wanted: ${claim.wantedTitle}`}>
            View Wanted
          </Link>
        </div>
      </article>
    </li>
  );
}

export function HuntWorkspace({ hunts, claims, now }: HuntWorkspaceProps) {
  return (
    <div className="hunt-workspace">
      {/* Both sections are rendered, so these jump to them rather than switch
          between them. Styled as equals: marking one as selected would claim a
          state the page does not have. */}
      <nav className="hunt-jump" aria-label="Skip to a Hunt section">
        <a href="#open-hunts">Open hunts</a>
        <a href="#my-claims">My claims</a>
      </nav>

      <section className="hunt-section" id="open-hunts" aria-labelledby="open-hunts-title">
        <div className="hunt-section__head">
          <h2 id="open-hunts-title">Open hunts</h2>
          <p>
            Match an authorised resource to a live request. Submission opens only after identity
            checks.
          </p>
        </div>
        {hunts.length === 0 ? (
          <UiStatus
            kind="empty"
            heading="No open hunts right now"
            message="New opportunities begin as students post and fund requests."
            action={<Link href="/board">Browse the Wanted Board</Link>}
          />
        ) : (
          <ul className="hunt-grid" aria-label="Open hunt opportunities">
            {hunts.map((hunt) => (
              <HuntCard key={hunt.id} hunt={hunt} now={now} />
            ))}
          </ul>
        )}
      </section>

      <section className="hunt-section" id="my-claims" aria-labelledby="my-claims-title">
        <div className="hunt-section__head">
          <h2 id="my-claims-title">My claims</h2>
          <p>
            Track what happens next. These fixtures demonstrate language only and are not account
            records.
          </p>
        </div>
        {claims.length === 0 ? (
          <UiStatus
            kind="empty"
            heading="You have no claims yet"
            message="Find an open hunt that matches material you are authorised to share."
            action={<a href="#open-hunts">Explore open hunts</a>}
          />
        ) : (
          <ul className="claim-list" aria-label="My claim history">
            {claims.map((claim) => (
              <ClaimCard key={claim.id} claim={claim} now={now} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
