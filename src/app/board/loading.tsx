import Link from "next/link";
import { WantedCardSkeleton } from "@/components/wanted-card-skeleton";

/**
 * Shown while the Board read is in flight: the real heading, then poster-
 * shaped placeholders where the cards will land, so the page does not jump
 * when they arrive.
 *
 * Moves no focus. Next swaps this for the resolved page inside `main`, and
 * taking focus on the way in or out would drag a keyboard reader away from
 * wherever they were. The placeholders are hidden from assistive technology;
 * one polite status says the Board is loading.
 */
export default function BoardLoading() {
  return (
    <div className="page-bare">
      <div className="panel page-heading">
        <div>
          <h1>Wanted Board</h1>
          <p className="page-heading__lede">
            Browse open academic requests across Malaysian campuses. Back a request or submit a
            claim.
          </p>
        </div>
        <Link className="button button--primary" href="/wanted/new">
          Post a Wanted <span aria-hidden="true">→</span>
        </Link>
      </div>

      <div className="board" aria-busy="true">
        <p className="visually-hidden" role="status">
          Loading the Wanted Board
        </p>
        <div className="panel board__head skeleton-panel" aria-hidden="true">
          <span className="skeleton skeleton--line skeleton--wide" />
          <span className="skeleton skeleton--field" />
        </div>
        <div className="board-surface board__results" aria-hidden="true">
          <ul className="wanted-grid">
            {Array.from({ length: 6 }, (_, index) => (
              <WantedCardSkeleton key={index} />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
