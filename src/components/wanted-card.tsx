import Link from "next/link";
import { BountyPlate } from "./bounty-plate";
import { ResourceEmblem } from "./resource-emblem";
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
 * One Wanted request, as a poster pinned to the Board.
 *
 * Carries the metadata `context/ui-context.md` requires — course,
 * institution/campus, resource type, academic period, gross bounty, Backer
 * count, age and safe status — and nothing about the file behind any claim.
 * Unreviewed content is quarantined and never described to a browser
 * (`context/architecture.md`).
 *
 * The portrait frame holds a drawing of the resource type, never the person
 * who asked: the Board does not expose a Commissioner
 * (docs/superpowers/specs/2026-09-16-vaultix-frontier-visual-handoff.md §1.2).
 * The "Wanted" masthead is decoration and hidden from assistive technology,
 * which would otherwise hear it once per poster.
 *
 * The metadata is a description list rather than a run-together meta line, so
 * a reader hears "Campus, UiTM Shah Alam" instead of three unlabelled
 * fragments separated by punctuation.
 *
 * The poster is not one large link. The title and the action both point at the
 * same Wanted, which keeps each accessible name meaningful when a reader lists
 * the links on a Board of twelve posters.
 */
export function WantedCard({ wanted, now }: WantedCardProps) {
  const href = `/wanted/${wanted.id}`;
  const titleId = `wanted-${wanted.id}-title`;
  const closing = formatClosing(wanted.closesAt, now);
  const isClosed = wanted.status === "closed";

  return (
    <li className="wanted-card">
      <article className="wanted-card__frame poster-paper pin" aria-labelledby={titleId}>
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

        <p className="stamp-row">
          <StatusStamp presentation={wantedStatusPresentation(wanted.status)} context="Wanted" />
        </p>

        <ResourceEmblem resourceType={wanted.resourceType} />

        <div className="wanted-card__head">
          <p className="wanted-card__course">
            <span className="wanted-card__course-code">{wanted.courseCode}</span>
            <span className="wanted-card__course-name">{wanted.courseName}</span>
          </p>
          <h3 className="wanted-card__title" id={titleId}>
            <Link href={href}>{wanted.title}</Link>
          </h3>
        </div>

        <div className="wanted-card__money">
          <BountyPlate amountSen={wanted.grossBountySen} />
          <p className="wanted-card__counts">
            {/* The plate above already speaks "Total bounty"; this caption is
                for the eye only. */}
            <span aria-hidden="true">Bounty ·</span>
            <span className="numeric">{describeBackers(wanted.backerCount)}</span>
          </p>
        </div>

        <dl className="index-grid" role="group" aria-label="Request details">
          <dt>Campus</dt>
          <dd>{wanted.campus}</dd>
          <dt>Resource</dt>
          <dd>{wanted.resourceType}</dd>
          <dt>Session</dt>
          <dd>{wanted.session}</dd>
        </dl>

        <div className="wanted-card__foot">
          <Link
            className="button button--ink wanted-card__action"
            href={href}
            aria-label={`View this Wanted: ${wanted.title}`}
          >
            View this Wanted <span aria-hidden="true">→</span>
          </Link>
        </div>
      </article>
    </li>
  );
}
