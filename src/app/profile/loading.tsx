import { UiStatus } from "@/components/ui-status";

/**
 * Shown while the account read is in flight.
 *
 * Deliberately moves no focus. Next swaps this for the resolved page inside
 * `main`, and stealing focus on the way in — or on the way out — would drag a
 * keyboard user away from wherever they were. `UiStatus` already marks the
 * region `aria-live="polite"` and `aria-busy`, so the wait is announced
 * without interrupting.
 */
export default function ProfileLoading() {
  return (
    <>
      <h1>Profile</h1>

      <UiStatus kind="loading" heading="Loading your account" />
    </>
  );
}
