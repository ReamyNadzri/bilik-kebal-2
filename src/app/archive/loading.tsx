import { PageSkeleton } from "@/components/loading/page-skeleton";
import { WantedCardSkeleton } from "@/components/wanted-card-skeleton";

export default function ArchiveLoading() {
  return (
    <PageSkeleton title="Archive" label="Loading the Archive">
      <div className="board-surface">
        <ul className="wanted-grid">
          {Array.from({ length: 6 }, (_, index) => (
            <WantedCardSkeleton key={index} />
          ))}
        </ul>
      </div>
    </PageSkeleton>
  );
}
