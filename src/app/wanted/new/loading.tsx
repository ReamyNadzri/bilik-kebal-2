import { PageSkeleton, SkeletonPanel } from "@/components/loading/page-skeleton";

export default function PostWantedLoading() {
  return (
    <PageSkeleton title="Post a Wanted" label="Checking what this account may post">
      <SkeletonPanel lines={6} />
    </PageSkeleton>
  );
}
