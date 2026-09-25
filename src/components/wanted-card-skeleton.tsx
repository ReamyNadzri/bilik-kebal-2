/**
 * A Wanted card's outline while the Board loads: masthead, drawing, title,
 * bounty and details as blank bars. Decorative; the page announces the load.
 */
export function WantedCardSkeleton() {
  return (
    <li className="wanted-card">
      <div className="wanted-poster poster-paper wanted-card__frame skeleton-poster">
        <span className="skeleton skeleton--masthead" />
        <span className="skeleton skeleton--emblem" />
        <span className="skeleton skeleton--line skeleton--wide" />
        <span className="skeleton skeleton--line" />
        <span className="skeleton skeleton--plate" />
        <span className="skeleton skeleton--line skeleton--short" />
        <span className="skeleton skeleton--button" />
      </div>
    </li>
  );
}
