import { PageSkeleton, SkeletonBlock, SkeletonPanel } from "@/components/loading/page-skeleton";

/** Any page without an outline of its own, including the homepage. */
export default function Loading() {
  return (
    <PageSkeleton label="Loading the page">
      <SkeletonBlock />
      <SkeletonPanel lines={3} />
    </PageSkeleton>
  );
}
