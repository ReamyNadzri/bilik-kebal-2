import { PageSkeleton, SkeletonPanel } from "@/components/loading/page-skeleton";

export default function NotificationsLoading() {
  return (
    <PageSkeleton title="Notifications" label="Loading your notifications">
      <SkeletonPanel lines={6} />
    </PageSkeleton>
  );
}
