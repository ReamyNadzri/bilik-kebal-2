import type { ReactNode } from "react";
import { LoadingIndicator } from "./loading-indicator";

/**
 * A page's outline while its data loads: the real heading when the page has a
 * fixed one, blank bars for everything else, and the loading indicator.
 *
 * Moves no focus: Next swaps this for the resolved page inside `main`, and
 * taking focus on the way in or out would drag a keyboard reader away from
 * wherever they were. The placeholders are hidden from assistive technology;
 * the indicator is the one polite status.
 */
export function PageSkeleton({
  title,
  lede,
  label,
  className = "page-bare",
  children,
}: {
  /** The page's fixed heading; omitted when the heading comes from data. */
  readonly title?: string;
  readonly lede?: string;
  /** What the indicator says is loading, e.g. "Loading the Archive". */
  readonly label: string;
  readonly className?: string;
  readonly children?: ReactNode;
}) {
  return (
    <div className={className} aria-busy="true">
      {title ? (
        <header className="panel page-heading">
          <div>
            <h1>{title}</h1>
            {lede ? <p className="page-heading__lede">{lede}</p> : null}
          </div>
        </header>
      ) : (
        <div className="panel page-heading skeleton-panel" aria-hidden="true">
          <span className="skeleton skeleton--title" />
          <span className="skeleton skeleton--line" />
        </div>
      )}
      <div className="page-skeleton__body" aria-hidden="true">
        {children}
      </div>
      <LoadingIndicator label={label} />
    </div>
  );
}

/** A panel of blank lines, for text and forms. */
export function SkeletonPanel({ lines = 4 }: { readonly lines?: number }) {
  const widths = ["skeleton--wide", "", "skeleton--short"];
  return (
    <div className="panel skeleton-panel">
      {Array.from({ length: lines }, (_, index) => (
        <span key={index} className={`skeleton skeleton--line ${widths[index % 3]}`.trim()} />
      ))}
    </div>
  );
}

/** One tall block, for a map, a poster or a picture. */
export function SkeletonBlock({ tall = false }: { readonly tall?: boolean }) {
  return (
    <div className="panel skeleton-panel">
      <span className={`skeleton ${tall ? "skeleton--block-tall" : "skeleton--block"}`} />
    </div>
  );
}
