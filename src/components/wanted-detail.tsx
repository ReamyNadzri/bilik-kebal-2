"use client";

import Link from "next/link";
import { useState } from "react";
import { BountyPlate } from "./bounty-plate";
import { ResourceEmblem } from "./resource-emblem";
import { StatusStamp } from "./status-stamp";
import { WantedCard } from "./wanted-card";
import { BackWantedModal } from "./back-wanted-modal";
import { ClaimSubmissionForm } from "./claim-submission-form";
import type { AccountViewModel } from "@/contracts/identity";
import { wantedStatusPresentation } from "@/features/marketplace/status";
import { formatClosing, formatPostedAge } from "@/features/marketplace/time";
import type { WantedDetail as Detail, WantedSummary } from "@/features/marketplace/types";

export interface WantedDetailProps {
  readonly wanted: Detail;
  readonly similar: readonly WantedSummary[];
  readonly now: string;
  readonly account?: AccountViewModel | null;
}

function describeBackers(count: number): string {
  if (count === 0) {
    return "No backers yet";
  }

  return `${count} backer${count === 1 ? "" : "s"}`;
}

/**
 * One Wanted request in full: the case file on the left; the poster, the
 * ledger and the trust panel on the right.
 *
 * Nothing about any submitted file appears here. Claims are quarantined until
 * a Sheriff approves one, so this page describes what is *wanted*, never what
 * has been supplied (`context/architecture.md`). There is no preview, no file
 * name, no object key and no download.
 *
 * The handoff's funding progress bar and "net reward to Hunter" line are not
 * drawn. A Wanted has no funding target, and the rounding of a percentage fee
 * on integer sen is unspecified; the snapshotted fee rate is stated instead
 * (docs/superpowers/specs/2026-09-16-vaultix-frontier-visual-handoff.md §6).
 *
 * The two protected actions link to institution verification rather than to a
 * form. Contributing and claiming both require institution verification, and
 * payment is disabled in this build; a control that looked live and did
 * nothing would be worse than one that says what it needs. The rule itself is
 * enforced server-side and by RLS — this is signposting, not a gate.
 */
export function WantedDetail({ wanted, similar, now, account }: WantedDetailProps) {
  const [isBackModalOpen, setIsBackModalOpen] = useState(false);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const closing = formatClosing(wanted.closesAt, now, { detail: true });
  const feePercent = wanted.feeRateBasisPoints / 100;

  return (
    <div className="wanted-detail">
      <header className="panel wanted-detail__header">
        <p className="wanted-detail__masthead">
          <StatusStamp
            presentation={wantedStatusPresentation(wanted.status)}
            context="This Wanted"
          />
          <time className="wanted-detail__posted" dateTime={wanted.postedAt}>
            {formatPostedAge(wanted.postedAt, now)}
          </time>
        </p>

        <h1 className="wanted-detail__title" id="wanted-title">
          {wanted.title}
        </h1>
      </header>

      {/* Before the case file in the DOM, not merely repositioned by `order`.
          At 360 px the bounty and the two actions must sit under the title
          rather than below the whole description, and reordering visually
          would leave the tab order disagreeing with what is on screen. Grid
          placement puts this column on the right at desktop. */}
      <aside className="wanted-detail__ledger" aria-label="Bounty and actions">
        <div className="ledger-poster poster-paper pin">
          <p className="poster-masthead">
            <span className="poster-masthead__word" aria-hidden="true">
              Wanted
            </span>
          </p>
          <ResourceEmblem resourceType={wanted.resourceType} />
          <p className="wanted-card__course">
            <span className="wanted-card__course-code">{wanted.courseCode}</span>
            <span className="wanted-card__course-name">{wanted.courseName}</span>
          </p>
          <div className="wanted-card__money">
            <BountyPlate amountSen={wanted.grossBountySen} size="large" />
            <p className="ledger-panel__backers numeric">{describeBackers(wanted.backerCount)}</p>
          </div>
          <p className="ledger-panel__closing">
            <time dateTime={wanted.closesAt}>{closing.label}</time>
          </p>
        </div>

        <div className="ledger-panel">
          {account?.capabilities?.transact && wanted.status === "open" ? (
            <button
              type="button"
              className="button button--primary ledger-panel__action"
              onClick={() => setIsBackModalOpen(true)}
            >
              Back this Wanted
            </button>
          ) : (
            <Link
              className="button button--primary ledger-panel__action"
              href="/profile/institution-verification"
            >
              Back this Wanted
            </Link>
          )}
          {account?.capabilities?.submitClaim && wanted.status === "open" ? (
            <button
              type="button"
              className="button button--secondary ledger-panel__action"
              onClick={() => setIsClaimModalOpen(true)}
            >
              Submit a Claim
            </button>
          ) : (
            <Link
              className="button button--secondary ledger-panel__action"
              href="/profile/institution-verification"
            >
              Submit a Claim
            </Link>
          )}
          <p className="ledger-panel__note">
            Both actions need institution verification. Contributions are RM1 to RM50 per Backer,
            and payment is disabled in this build until the launch gate passes.
          </p>
        </div>

        <div className="ledger-panel">
          <h2 className="ledger-panel__heading">Fees</h2>
          <p className="ledger-panel__fee">
            <span>Platform fee, fixed at publication</span>
            <span className="numeric">{feePercent}%</span>
          </p>
          <p className="ledger-panel__body">
            A {feePercent}% platform fee is taken from the bounty when a claim is approved. The rate
            was fixed when this Wanted was published and does not change afterwards.
          </p>
          <p className="ledger-panel__body">
            The payment provider adds its own charge to a Backer&rsquo;s checkout total. It is paid
            on top of the contribution, so the bounty rises by the full amount contributed.
          </p>
        </div>

        <div className="ledger-panel">
          <h2 className="ledger-panel__heading">Who posted this</h2>
          <p className="ledger-panel__commissioner">{wanted.commissioner.displayName}</p>
          <dl className="index-grid ledger-panel__trust">
            <dt>Email verified</dt>
            <dd>
              {wanted.commissioner.emailVerified ? "Yes" : "No"}. This proves control of an email
              address and nothing more.
            </dd>
            <dt>Institution verified</dt>
            <dd>
              {wanted.commissioner.institutionVerified ? "Yes" : "No"}. This permits funding a
              bounty, submitting a claim and downloading an approved resource. It confirms
              affiliation only and does not guarantee the quality of any resource.
            </dd>
          </dl>
          <p className="ledger-panel__body">
            No automated check can approve a claim. A human Sheriff decides, and only then is access
            granted or a bounty paid.
          </p>
        </div>
      </aside>

      {/* Named by its own title so the case file is addressable next to the
          similar-request posters, which are also articles. */}
      <article className="panel wanted-detail__case" aria-labelledby="wanted-title">
        <p className="wanted-detail__description">{wanted.description}</p>

        <dl
          className="fact-table wanted-detail__facts"
          role="group"
          aria-label="Full request details"
        >
          <div className="fact-table__cell">
            <dt>Course</dt>
            <dd>{`${wanted.courseCode} ${wanted.courseName}`}</dd>
          </div>
          <div className="fact-table__cell">
            <dt>Campus</dt>
            <dd>{wanted.campus}</dd>
          </div>
          <div className="fact-table__cell">
            <dt>Faculty</dt>
            <dd>{wanted.faculty}</dd>
          </div>
          <div className="fact-table__cell">
            <dt>Programme</dt>
            <dd>{wanted.programme}</dd>
          </div>
          <div className="fact-table__cell">
            <dt>Session</dt>
            <dd>{wanted.session}</dd>
          </div>
          <div className="fact-table__cell">
            <dt>Resource</dt>
            <dd>{wanted.resourceType}</dd>
          </div>
          <div className="fact-table__cell">
            <dt>Language</dt>
            <dd>{wanted.language}</dd>
          </div>
        </dl>

        {wanted.tags.length === 0 ? null : (
          <ul className="tag-row" aria-label="Tags">
            {wanted.tags.map((tag) => (
              <li className="tag-row__tag" key={tag}>
                {tag}
              </li>
            ))}
          </ul>
        )}

        <section className="wanted-detail__section">
          <h2>What may be submitted</h2>
          <p className="policy-note">
            A claim may contain only material the Hunter is allowed to share. Publisher textbooks,
            paid tutorial material, leaked papers and institution-restricted documents are not
            permitted. Files stay in private quarantine, and a Sheriff must approve a claim before
            any resource is released or any bounty is paid.
          </p>
          {/* The version this request was published under, not whatever the
              policy says today. Snapshotting is an invariant
              (context/architecture.md), so the version travels with the Wanted
              and a later revision cannot be applied to it retroactively. */}
          <p className="wanted-detail__policy-version">
            Content policy version {wanted.policyVersion}, fixed when this request was published.
          </p>
        </section>

        <section className="wanted-detail__section">
          <h2>Bounty activity</h2>
          <ol className="activity" aria-label="Activity on this Wanted">
            {wanted.activity.map((event) => (
              <li className="activity__event" key={event.id}>
                <time className="activity__when" dateTime={event.at}>
                  {formatPostedAge(event.at, now).replace("Posted ", "")}
                </time>
                <span className="activity__what">{event.summary}</span>
              </li>
            ))}
          </ol>
        </section>
      </article>

      {/* Deliberately outside the case file: these are other people's requests,
          and nesting them in this request's article would make every poster's
          status and counts read as part of it. */}
      {similar.length === 0 ? null : (
        <section className="board-surface wanted-detail__similar">
          <h2>Similar requests</h2>
          <p className="wanted-detail__similar-note">
            Backing an existing request builds one larger bounty instead of splitting the class
            across two.
          </p>
          <ul className="wanted-grid" aria-label="Similar Wanted requests">
            {similar.map((other) => (
              <WantedCard key={other.id} wanted={other} now={now} />
            ))}
          </ul>
        </section>
      )}

      {isBackModalOpen ? (
        <BackWantedModal wanted={wanted} onClose={() => setIsBackModalOpen(false)} />
      ) : null}

      {isClaimModalOpen ? (
        <ClaimSubmissionForm wanted={wanted} onClose={() => setIsClaimModalOpen(false)} />
      ) : null}
    </div>
  );
}
