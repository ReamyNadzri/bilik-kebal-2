import { UiStatus } from "@/components/ui-status";

export default function ClaimsLoading() {
  return (
    <>
      <h1>Hunt</h1>
      <UiStatus kind="loading" heading="Loading hunts and claims" />
    </>
  );
}
