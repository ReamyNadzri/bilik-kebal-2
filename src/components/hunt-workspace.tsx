import Link from "next/link";
import { StatusStamp } from "./status-stamp";
import { Tabs } from "./tabs";
import { UiStatus } from "./ui-status";
import {
  claimStages,
  claimStatusPresentation,
  type ClaimStageState,
} from "@/features/marketplace/status";
import { formatSubmittedAge } from "@/features/marketplace/time";
import type { ClaimSummary, WantedSummary } from "@/features/marketplace/types";
import { WantedCard } from "./wanted-card";

export interface HuntWorkspaceProps {
  /** The viewer's own Wanted requests, or null when signed out. */
  readonly myPosts: readonly WantedSummary[] | null;
  readonly claims: readonly ClaimSummary[];
  readonly now: string;
}

/** Spoken beside each station, so the track reads without its colours. */
const STAGE_STATE_WORDS: Record<ClaimStageState, string> = {
  done: "completed",
  current: "current stage",
  ended: "ended here",
  stopped: "stopped here",
  ahead: "not reached",
};

function StageTrack({ claim }: { readonly claim: ClaimSummary }) {
  return (
    <ol className="stage-track" aria-label={`Progress of this claim: ${claim.wantedTitle}`}>
      {claimStages(claim.status).map((stage, index) => (
        <li
          className={`stage-track__stage stage-track__stage--${stage.state}`}
          key={stage.label}
          aria-current={stage.state === "current" ? "step" : undefined}
        >
          <span className="stage-track__mark" aria-hidden="true">
            {stage.state === "done" ? "✓" : index + 1}
          </span>
          <span>
            {stage.label}
            <span className="visually-hidden">{`, ${STAGE_STATE_WORDS[stage.state]}`}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function ClaimCard({ claim, now }: { readonly claim: ClaimSummary; readonly now: string }) {
  const presentation = claimStatusPresentation(claim.status);

  return (
    <li className="claim-card">
      <article aria-labelledby={`claim-${claim.id}`}>
        <div className="claim-card__head">
          <div className="claim-card__title">
            <h3 id={`claim-${claim.id}`}>{claim.wantedTitle}</h3>
            <p className="claim-card__course">
              <strong>{claim.courseCode}</strong> {claim.courseName} ·{" "}
              {claim.submittedAt === null ? (
                "Not submitted"
              ) : (
                <time dateTime={claim.submittedAt}>
                  {formatSubmittedAge(claim.submittedAt, now)}
                </time>
              )}
            </p>
          </div>
          <StatusStamp presentation={presentation} context="Claim" />
        </div>
        <StageTrack claim={claim} />
        <div className="claim-card__foot">
          <p className="claim-card__next">{presentation.nextStep}</p>
          <Link
            className="button button--green"
            href={`/wanted/${claim.wantedId}`}
            prefetch={false}
            aria-label={`View Wanted: ${claim.wantedTitle}`}
          >
            View Wanted
          </Link>
        </div>
      </article>
    </li>
  );
}

export function HuntWorkspace({ myPosts, claims, now }: HuntWorkspaceProps) {
  const myHunt = (
    <section className="board-surface hunt-section" aria-labelledby="my-hunt-title">
      <div className="hunt-section__head">
        <h2 id="my-hunt-title">My hunt</h2>
        <p>The requests you posted, as they hang on the Board.</p>
      </div>
      {myPosts === null ? (
        <UiStatus
          kind="restricted"
          heading="Sign in to see your requests"
          message="Your own Wanted requests appear here once you are signed in."
        />
      ) : myPosts.length === 0 ? (
        <UiStatus
          kind="empty"
          heading="You have not posted a request yet"
          message="Ask for a resource, report a missing item or start a discussion."
          action={<Link href="/wanted/new">Post a Wanted</Link>}
        />
      ) : (
        <ul className="wanted-grid" aria-label="Your Wanted requests">
          {myPosts.map((wanted) => (
            <WantedCard key={wanted.id} wanted={wanted} now={now} />
          ))}
        </ul>
      )}
    </section>
  );

  const myClaims = (
    <section className="panel hunt-section" aria-labelledby="my-claims-title">
      <div className="hunt-section__head">
        <h2 id="my-claims-title">My claims</h2>
        <p>Every claim moves through five stations, and only a Sheriff can approve one.</p>
      </div>
      {claims.length === 0 ? (
        <UiStatus
          kind="empty"
          heading="You have no claims yet"
          message="Find an open hunt that matches material you are authorised to share."
          action={<Link href="/board">Browse the Wanted Board</Link>}
        />
      ) : (
        <ul className="claim-list" aria-label="My claim history">
          {claims.map((claim) => (
            <ClaimCard key={claim.id} claim={claim} now={now} />
          ))}
        </ul>
      )}
      <p className="hunt-ledger__note">
        Not selected means your claim was valid but another claim was chosen. Rejected is a separate
        outcome and can be appealed.
      </p>
    </section>
  );

  return (
    <div className="hunt-workspace">
      <Tabs
        label="Hunt sections"
        items={[
          {
            id: "my-hunt",
            label: myPosts === null ? "My hunt" : `My hunt (${myPosts.length})`,
            panel: myHunt,
          },
          { id: "my-claims", label: `My claims (${claims.length})`, panel: myClaims },
        ]}
      />
    </div>
  );
}
