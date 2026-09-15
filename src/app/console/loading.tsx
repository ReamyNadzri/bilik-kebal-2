import { UiStatus } from "@/components/ui-status";

/**
 * Moves no focus: Next swaps this for the resolved page inside `main`, and
 * taking focus would drag a reviewer away from wherever they were.
 */
export default function ConsoleLoading() {
  return (
    <>
      <h1>Sheriff Console</h1>

      <UiStatus kind="loading" heading="Loading the review queue" />
    </>
  );
}
