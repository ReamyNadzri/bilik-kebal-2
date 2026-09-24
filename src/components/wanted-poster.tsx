import type { ReactNode } from "react";
import { BountyPlate } from "./bounty-plate";
import { StatusStamp } from "./status-stamp";
import { wantedStatusPresentation } from "@/features/marketplace/status";
import { formatAgeOld, formatClosing, formatPostedAge } from "@/features/marketplace/time";
import type { WantedSummary } from "@/features/marketplace/types";

export interface WantedPosterProps {
  readonly wanted: WantedSummary;
  /** Reference instant for relative times. Never read from the clock here. */
  readonly now: string;
  /**
   * The request's own title. On the Board it is a link heading; on the detail
   * page the page heading already carries it, so the poster omits it.
   */
  readonly title?: ReactNode;
  /** The poster's closing line, below the status stamp — usually one action. */
  readonly footer?: ReactNode;
  readonly className?: string;
  readonly labelledBy?: string;
}

const KIND_HEADING: Record<WantedSummary["kind"], string> = {
  academic: "",
  missing_item: "Missing item",
  discussion: "Discussion",
};

export function describeBackers(count: number): string {
  if (count === 0) {
    return "No backers yet";
  }

  return `${count} backer${count === 1 ? "" : "s"}`;
}

/**
 * One Wanted as a pinned poster: masthead and time left, the course, the
 * title, the bounty with its backers and age, the request details, the status
 * stamp and one action. The Board card and the detail page's ledger share this
 * body so a request looks the same wherever it is pinned.
 *
 * The "Wanted" masthead is decoration and hidden from assistive technology,
 * which would otherwise hear it once per poster. The bounty plate speaks one
 * complete sentence ("Total bounty RM 42.00").
 */
export function WantedPoster({
  wanted,
  now,
  title,
  footer,
  className = "",
  labelledBy,
}: WantedPosterProps) {
  const closing = formatClosing(wanted.closesAt, now, { phrasing: "left" });
  const academic = wanted.kind === "academic";
  const isClosed = wanted.status === "closed";

  return (
    <article
      className={`wanted-poster poster-paper pin ${className}`.trim()}
      aria-labelledby={labelledBy}
    >
      <p className="poster-masthead">
        <span className="poster-masthead__word" aria-hidden="true">
          Wanted
        </span>
        {isClosed ? (
          <time className="poster-masthead__timing" dateTime={wanted.postedAt}>
            {formatPostedAge(wanted.postedAt, now)}
          </time>
        ) : (
          <time
            className={`poster-masthead__timing${closing.urgent ? " poster-masthead__timing--urgent" : ""}`}
            dateTime={wanted.closesAt}
          >
            {closing.label}
          </time>
        )}
      </p>

      <div className="wanted-poster__head">
        {academic ? (
          <p className="wanted-card__course">
            <span className="wanted-card__course-code">{wanted.courseCode}</span>
            <span className="wanted-card__course-name">{wanted.courseName}</span>
          </p>
        ) : (
          <p className="wanted-card__course">
            <span className="wanted-card__course-code">{KIND_HEADING[wanted.kind]}</span>
          </p>
        )}
        {title}
      </div>

      <div className="wanted-card__money">
        {wanted.isFree ? (
          <p className="free-plate">Free request</p>
        ) : (
          <BountyPlate amountSen={wanted.grossBountySen} />
        )}
        <p className="wanted-card__counts">
          {wanted.isFree ? (
            <span>No bounty</span>
          ) : (
            <span className="numeric">{describeBackers(wanted.backerCount)}</span>
          )}
          <span aria-hidden="true">·</span>
          <span>{formatAgeOld(wanted.postedAt, now)}</span>
        </p>
      </div>

      <dl className="index-grid wanted-poster__facts" role="group" aria-label="Request details">
        <dt>Campus</dt>
        <dd>{wanted.campus}</dd>
        <dt>Type</dt>
        <dd>{wanted.resourceType}</dd>
        {academic ? (
          <>
            <dt>Session</dt>
            <dd>{wanted.session}</dd>
          </>
        ) : null}
        {wanted.kind === "missing_item" && wanted.lastSeenLocation ? (
          <>
            <dt>Last seen</dt>
            <dd>{wanted.lastSeenLocation}</dd>
          </>
        ) : null}
      </dl>

      <p className="stamp-row wanted-poster__stamp">
        <StatusStamp presentation={wantedStatusPresentation(wanted.status)} context="Wanted" />
      </p>

      {footer === undefined ? null : <div className="wanted-card__foot">{footer}</div>}
    </article>
  );
}
