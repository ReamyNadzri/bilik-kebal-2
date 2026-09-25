import type { Metadata } from "next";
import { BadgeConsole } from "@/components/badge-console";
import { ConsoleNav } from "@/components/console-nav";
import { UiStatus } from "@/components/ui-status";
import { requireAccount } from "@/features/presentation/auth/require-account";
import {
  listConsoleBadges,
  readConsoleRole,
  searchConsoleMembers,
} from "@/modules/console/loaders/console-operations";

export const metadata: Metadata = {
  title: "Badges | VAULTIX",
};

export const dynamic = "force-dynamic";

export default async function ConsoleBadgesPage() {
  await requireAccount("/console/badges");
  const role = await readConsoleRole();
  if (!role.ok || role.data !== "owner") {
    return (
      <>
        <ConsoleNav current="badges" showTabs={role.ok && role.data !== null} />
        <UiStatus
          kind="restricted"
          heading="The Owner only"
          message="Only the Owner designs and awards badges."
        />
      </>
    );
  }
  const [badges, members] = await Promise.all([listConsoleBadges(), searchConsoleMembers(null)]);
  return (
    <>
      <ConsoleNav current="badges" />
      {badges.ok ? (
        <BadgeConsole badges={badges.data} members={members.ok ? members.data : null} />
      ) : (
        <UiStatus kind="error" heading="Badges could not be loaded" message={badges.message} />
      )}
    </>
  );
}
