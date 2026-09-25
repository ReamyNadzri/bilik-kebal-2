import type { ReactNode } from "react";
import { WantedCard } from "./wanted-card";
import type { WantedSummary } from "@/features/marketplace/types";

export interface ProfileWantedGridProps {
  readonly heading: string;
  readonly wanted: readonly WantedSummary[];
  readonly now: string;
  readonly empty: ReactNode;
}

/** A member's posted Wanteds as a grid of posters, newest first. */
export function ProfileWantedGrid({ heading, wanted, now, empty }: ProfileWantedGridProps) {
  return (
    <section className="board-surface profile-grid" aria-labelledby="profile-grid-heading">
      <h2 id="profile-grid-heading" className="board-surface__heading">
        {heading}
      </h2>
      {wanted.length === 0 ? (
        <div className="panel">{empty}</div>
      ) : (
        <ul className="wanted-grid" aria-label={heading}>
          {wanted.map((item) => (
            <WantedCard key={item.id} wanted={item} now={now} />
          ))}
        </ul>
      )}
    </section>
  );
}
