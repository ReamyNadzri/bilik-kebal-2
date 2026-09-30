import { PageSkeleton, SkeletonPanel } from "@/components/loading/page-skeleton";

export default function InstitutionVerificationLoading() {
  return (
    <PageSkeleton title="Institution verification" label="Loading your verification status">
      <SkeletonPanel lines={5} />
    </PageSkeleton>
  );
}
