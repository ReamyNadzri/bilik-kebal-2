import type { Metadata } from "next";
import { ConsoleNav } from "@/components/console-nav";
import { ConsoleRequests } from "@/components/console-requests";
import { requireAccount } from "@/features/presentation/auth/require-account";
import { readConsoleRole } from "@/modules/console/loaders/console-operations";
import { listTaxonomyRequestQueue } from "@/modules/taxonomy-requests/loaders/taxonomy-request-operations";
import { listPendingCommunityPayouts } from "@/modules/wanted/loaders/wanted-operations";

export const metadata: Metadata = {
  title: "Entries & releases | VAULTIX",
};

export const dynamic = "force-dynamic";

/**
 * New list entries and bounty releases. RLS decides which rows a Sheriff sees
 * (platform-wide or their own institution), and every decision is authorised
 * again in the database.
 */
export default async function ConsoleRequestsPage() {
  // The guard is a courtesy, not access control: every read here is authorised
  // by its own operation and RLS, so they start with it rather than after it.
  const [, entries, releases, role] = await Promise.all([
    requireAccount("/console/requests"),
    listTaxonomyRequestQueue(),
    listPendingCommunityPayouts(),
    readConsoleRole(),
  ]);

  return (
    <>
      <ConsoleNav current="requests" />
      <ConsoleRequests
        entries={entries.ok ? entries.data : null}
        releases={releases.ok ? releases.data : null}
        viewerRole={role.ok ? role.data : null}
      />
    </>
  );
}
