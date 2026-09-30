import { PageSkeleton, SkeletonBlock, SkeletonPanel } from "@/components/loading/page-skeleton";

export default function MapLoading() {
  return (
    <PageSkeleton title="Where is knowledge needed?" label="Loading the campus map">
      <SkeletonBlock tall />
      <SkeletonPanel lines={3} />
    </PageSkeleton>
  );
}
