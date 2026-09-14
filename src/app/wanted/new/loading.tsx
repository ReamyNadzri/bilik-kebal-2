import { UiStatus } from "@/components/ui-status";

/**
 * Shown while the account read is in flight.
 *
 * Moves no focus. Next swaps this for the resolved page inside `main`, and
 * taking focus on the way in or out would drag a keyboard reader away from
 * wherever they were. `UiStatus` already marks the region `aria-live="polite"`
 * and `aria-busy`, so the wait is announced without interrupting.
 */
export default function PostWantedLoading() {
  return (
    <>
      <h1>Post a Wanted</h1>

      <UiStatus kind="loading" heading="Checking what this account may post" />
    </>
  );
}
