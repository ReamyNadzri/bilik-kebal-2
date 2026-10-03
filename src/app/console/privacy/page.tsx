import type { Metadata } from "next";
import { ConsoleNav } from "@/components/console-nav";
import { PrivacyRequestConsole } from "@/components/privacy-request-console";
import { UiStatus } from "@/components/ui-status";
import { requireAccount } from "@/features/presentation/auth/require-account";
import { readConsoleRole } from "@/modules/console/loaders/console-operations";
import { listPrivacyRequests } from "@/modules/legal/loaders/legal-operations";

export const metadata: Metadata = {
  title: "Privacy requests | VAULTIX",
};

export const dynamic = "force-dynamic";

export default async function ConsolePrivacyPage() {
  // The guard is a courtesy, not access control: the queue is the Owner's
  // alone in the database, so the reads start with the guard rather than after it.
  const [, role, open, answered] = await Promise.all([
    requireAccount("/console/privacy"),
    readConsoleRole(),
    listPrivacyRequests("open"),
    listPrivacyRequests("answered"),
  ]);
  if (!role.ok || role.data !== "owner") {
    return (
      <>
        <ConsoleNav current="privacy" showTabs={role.ok && role.data !== null} />
        <UiStatus
          kind="restricted"
          heading="The Owner only"
          message="Only the Owner reads and answers members' privacy requests."
        />
      </>
    );
  }
  return (
    <>
      <ConsoleNav current="privacy" />
      {open.ok ? (
        <PrivacyRequestConsole open={open.data} answered={answered.ok ? answered.data : null} />
      ) : (
        <UiStatus
          kind="error"
          heading="Privacy requests could not be loaded"
          message={open.message}
        />
      )}
    </>
  );
}
