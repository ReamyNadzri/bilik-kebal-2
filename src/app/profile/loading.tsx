import { PageSkeleton, SkeletonBlock, SkeletonPanel } from "@/components/loading/page-skeleton";

export default function ProfileLoading() {
  return (
    <PageSkeleton title="Profile" label="Loading your account">
      <SkeletonBlock />
      <SkeletonPanel lines={5} />
    </PageSkeleton>
  );
}
