import type { Metadata } from "next";
import { ConsoleNav } from "@/components/console-nav";
import { HiddenRepliesConsole } from "@/components/hidden-replies-console";
import { UiStatus } from "@/components/ui-status";
import { WantedReportsConsole } from "@/components/wanted-reports-console";
import { requireAccount } from "@/features/presentation/auth/require-account";
import { listConsoleHiddenReplies } from "@/modules/console/loaders/console-operations";
import { listWantedReports } from "@/modules/wanted/loaders/wanted-report-operations";

export const metadata: Metadata = {
  title: "Reports and hidden messages | VAULTIX",
};

export const dynamic = "force-dynamic";

export default async function ConsoleModerationPage() {
  // The guard is a courtesy, not access control: every read here is authorised
  // by its own operation and RLS, so they start with it rather than after it.
  const [, replies, reports] = await Promise.all([
    requireAccount("/console/moderation"),
    listConsoleHiddenReplies(),
    listWantedReports(),
  ]);

  return (
    <>
      <ConsoleNav current="moderation" />
      {reports.ok ? (
        <WantedReportsConsole reports={reports.data} />
      ) : reports.code === "NOT_AUTHORIZED" ? null : (
        <UiStatus kind="error" heading="Reports could not be loaded" message={reports.message} />
      )}
      {replies.ok ? (
        <HiddenRepliesConsole replies={replies.data} />
      ) : replies.code === "NOT_AUTHORIZED" ? (
        <UiStatus
          kind="restricted"
          heading="The Owner and Sheriffs only"
          message="Your account does not have a console role."
        />
      ) : (
        <UiStatus
          kind="error"
          heading="Hidden messages could not be loaded"
          message={replies.message}
        />
      )}
    </>
  );
}
