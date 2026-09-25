import { ConsoleNav } from "@/components/console-nav";
import { UiStatus } from "@/components/ui-status";

/**
 * Moves no focus: Next swaps this for the resolved page inside `main`, and
 * taking focus would drag a reviewer away from wherever they were.
 */
export default function ConsoleLoading() {
  return (
    <>
      <ConsoleNav current="overview" showTabs={false} />

      <UiStatus kind="loading" heading="Loading the review queue" />
    </>
  );
}
