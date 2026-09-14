import Link from "next/link";
import { BountyPlate } from "./bounty-plate";
import { StatusStamp } from "./status-stamp";
import { wantedStatusPresentation } from "@/features/marketplace/status";
import { formatClosing, formatPostedAge } from "@/features/marketplace/time";
import type { WantedSummary } from "@/features/marketplace/types";

export interface WantedCardProps {
  readonly wanted: WantedSummary;
  /** Reference instant for relative times. Never read from the clock here. */
  readonly now: string;
}

function describeBackers(count: number): string {
  if (count === 0) {
    return "No backers yet";
  }

  return `${count} backer${count === 1 ? "" : "s"}`;
}

/**
 * One Wanted request, as a card on the Board.
 *
 * Carries the metadata `context/ui-context.md` requires — course,
 * institution/campus, resource type, academic period, gross bounty, Backer
 * count, age and safe status — and nothing about the file behind any claim.
 * Unreviewed content is quarantined and never described to a browser
 * (`context/architecture.md`).
 *
 * The metadata is a description list rather than a run-together meta line, so
 * a reader hears "Campus, UiTM Shah Alam" instead of three unlabelled
 * fragments separated by punctuation.
 *
 * The card is not one large link. The title and the action both point at the
 * same Wanted, which keeps each accessible name meaningful when a reader lists
 * the links on a Board of twelve cards.
 */
export function WantedCard({ wanted, now }: WantedCardProps) {
  const href = `/wanted/${wanted.id}`;
  const titleId = `wanted-${wanted.id}-title`;
  const closing = formatClosing(wanted.closesAt, now);
  const isClosed = wanted.status === "closed";

  return (
    <li className="wanted-card">
      <article className="wanted-card__frame" aria-labelledby={titleId}>
        <span className="wanted-card__tab" aria-hidden="true" />

        <div className="wanted-card__head">
          <p className="wanted-card__course">
            <span className="wanted-card__course-code">{wanted.courseCode}</span>
            <span className="wanted-card__course-name">{wanted.courseName}</span>
          </p>
          <h3 className="wanted-card__title" id={titleId}>
            <Link href={href}>{wanted.title}</Link>
          </h3>
        </div>

        <BountyPlate amountSen={wanted.grossBountySen} />

        <dl className="index-grid" role="group" aria-label="Request details">
          <dt>Campus</dt>
          <dd>{wanted.campus}</dd>
          <dt>Resource</dt>
          <dd>{wanted.resourceType}</dd>
          <dt>Session</dt>
          <dd>{wanted.session}</dd>
        </dl>

        <div className="wanted-card__foot">
          <StatusStamp presentation={wantedStatusPresentation(wanted.status)} context="Wanted" />

          <p className="wanted-card__counts">
            <span className="numeric">{describeBackers(wanted.backerCount)}</span>
            {isClosed ? (
              <time dateTime={wanted.postedAt}>{formatPostedAge(wanted.postedAt, now)}</time>
            ) : (
              <time
                dateTime={wanted.closesAt}
                className={closing.urgent ? "wanted-card__closing--urgent" : undefined}
              >
                {closing.label}
              </time>
            )}
          </p>

          <Link className="wanted-card__action" href={href}>
            View this Wanted
            <span className="visually-hidden">{`: ${wanted.title}`}</span>
          </Link>
        </div>
      </article>
    </li>
  );
}
