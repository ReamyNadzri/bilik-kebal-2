import type { Metadata } from "next";
import { ConsoleNav } from "@/components/console-nav";
import { MemberConsole } from "@/components/member-console";
import { UiStatus } from "@/components/ui-status";
import { requireAccount } from "@/features/presentation/auth/require-account";
import { loadSelectableInstitutions } from "@/modules/identity/loaders/identity-read";
import {
  listConsoleBadges,
  readConsoleRole,
  searchConsoleMembers,
} from "@/modules/console/loaders/console-operations";

export const metadata: Metadata = {
  title: "People | VAULTIX",
};

export const dynamic = "force-dynamic";

/**
 * People management for the Owner and Sheriffs. The role and the member list
 * come from database functions that scope them to the caller; this page only
 * presents what they return.
 */
export default async function ConsolePeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAccount("/console/people");
  const { q = "" } = await searchParams;
  const role = await readConsoleRole();

  if (!role.ok || role.data === null) {
    return (
      <>
        <ConsoleNav current="people" showTabs={false} />
        <UiStatus
          kind="restricted"
          heading="The Owner and Sheriffs only"
          message="Your account does not have a console role."
        />
      </>
    );
  }

  const [members, institutions, badges] = await Promise.all([
    searchConsoleMembers(q || null),
    loadSelectableInstitutions().catch(() => null),
    role.data === "owner" ? listConsoleBadges() : Promise.resolve(null),
  ]);

  return (
    <>
      <ConsoleNav current="people" />
      <MemberConsole
        role={role.data}
        query={q}
        members={members.ok ? members.data : null}
        institutions={institutions?.status === "ready" ? institutions.institutions : []}
        badges={badges?.ok ? badges.data : []}
      />
    </>
  );
}
