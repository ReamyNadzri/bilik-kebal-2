import { ConsoleNav } from "@/components/console-nav";
import { LoadingIndicator } from "@/components/loading/loading-indicator";
import { SkeletonPanel } from "@/components/loading/page-skeleton";

/**
 * Moves no focus: Next swaps this for the resolved page inside `main`, and
 * taking focus would drag a reviewer away from wherever they were.
 */
export default function ConsoleLoading() {
  return (
    <>
      <ConsoleNav current="overview" showTabs={false} />
      <div className="page-skeleton__body" aria-busy="true">
        <div aria-hidden="true">
          <SkeletonPanel lines={6} />
        </div>
        <LoadingIndicator label="Loading the review queue" />
      </div>
    </>
  );
}
