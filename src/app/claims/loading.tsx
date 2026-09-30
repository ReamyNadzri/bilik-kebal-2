import { PageSkeleton, SkeletonPanel } from "@/components/loading/page-skeleton";
import { WantedCardSkeleton } from "@/components/wanted-card-skeleton";

export default function ClaimsLoading() {
  return (
    <PageSkeleton title="Hunt" label="Loading hunts and claims">
      <SkeletonPanel lines={3} />
      <div className="board-surface">
        <ul className="wanted-grid">
          {Array.from({ length: 3 }, (_, index) => (
            <WantedCardSkeleton key={index} />
          ))}
        </ul>
      </div>
    </PageSkeleton>
  );
}
