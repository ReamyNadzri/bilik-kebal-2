import type { Metadata } from "next";
import { ConsoleNav } from "@/components/console-nav";
import { HiddenRepliesConsole } from "@/components/hidden-replies-console";
import { UiStatus } from "@/components/ui-status";
import { requireAccount } from "@/features/presentation/auth/require-account";
import { listConsoleHiddenReplies } from "@/modules/console/loaders/console-operations";

export const metadata: Metadata = {
  title: "Hidden messages | VAULTIX",
};

export const dynamic = "force-dynamic";

export default async function ConsoleModerationPage() {
  await requireAccount("/console/moderation");
  const replies = await listConsoleHiddenReplies();

  return (
    <>
      <ConsoleNav current="moderation" />
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
