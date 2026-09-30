import { PageSkeleton, SkeletonBlock, SkeletonPanel } from "@/components/loading/page-skeleton";

export default function WantedLoading() {
  return (
    <PageSkeleton label="Loading this Wanted">
      <SkeletonBlock tall />
      <SkeletonPanel lines={5} />
    </PageSkeleton>
  );
}
