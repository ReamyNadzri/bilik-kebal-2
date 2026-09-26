import { ShotLink } from "./motion/gunshot-transition";
import { WantedPoster } from "./wanted-poster";
import type { WantedSummary } from "@/features/marketplace/types";

export interface WantedCardProps {
  readonly wanted: WantedSummary;
  /** Reference instant for relative times. Never read from the clock here. */
  readonly now: string;
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
 * The poster is not one large link. The title and the action both point at the
 * same Wanted, which keeps each accessible name meaningful when a reader lists
 * the links on a Board of twelve posters.
 *
 * Neither link is prefetched. A Wanted is rendered per request with no loading
 * state of its own, so a prefetch would fetch only its route shape — one
 * server request per poster on sight, for a Board of dozens — and the click
 * would still wait for the page.
 */
export function WantedCard({ wanted, now }: WantedCardProps) {
  const href = `/wanted/${wanted.id}`;
  const titleId = `wanted-${wanted.id}-title`;

  return (
    <li className="wanted-card">
      <WantedPoster
        wanted={wanted}
        now={now}
        className="wanted-card__frame"
        labelledBy={titleId}
        withEmblem
        title={
          <h3 className="wanted-card__title" id={titleId}>
            <ShotLink href={href} prefetch={false}>
              {wanted.title}
            </ShotLink>
          </h3>
        }
        footer={
          <ShotLink
            className="button button--ink wanted-card__action"
            href={href}
            prefetch={false}
            aria-label={`View this Wanted: ${wanted.title}`}
          >
            View Wanted
          </ShotLink>
        }
      />
    </li>
  );
}
