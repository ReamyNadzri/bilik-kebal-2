import type { Metadata } from "next";
import { NotificationInbox } from "@/components/notification-inbox";
import { requireAccount } from "@/features/presentation/auth/require-account";

export const metadata: Metadata = {
  title: "Notifications | VAULTIX",
  description: "Read important account, verification and claim updates.",
};

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  await requireAccount("/notifications");
  return (
    <div className="page-bare">
      <header className="panel page-heading">
        <div>
          <h1>Notifications</h1>
          <p className="page-heading__lede">
            Important account, institution verification and claim updates.
          </p>
        </div>
      </header>
      <div className="panel">
        <NotificationInbox />
      </div>
    </div>
  );
}
