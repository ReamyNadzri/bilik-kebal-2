import { PageSkeleton, SkeletonBlock } from "@/components/loading/page-skeleton";
import { WantedCardSkeleton } from "@/components/wanted-card-skeleton";

export default function PublicProfileLoading() {
  return (
    <PageSkeleton label="Loading this profile" className="page-bare profile-container">
      <SkeletonBlock />
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
