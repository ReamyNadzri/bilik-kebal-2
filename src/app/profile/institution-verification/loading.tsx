import { UiStatus } from "@/components/ui-status";

/**
 * Moves no focus. Next swaps this for the resolved page inside `main`, and
 * taking focus on the way in or out would drag a keyboard user away from where
 * they were.
 */
export default function InstitutionVerificationLoading() {
  return (
    <>
      <h1>Institution verification</h1>

      <UiStatus kind="loading" heading="Loading your verification status" />
    </>
  );
}
