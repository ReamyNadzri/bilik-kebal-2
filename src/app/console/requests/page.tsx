import type { Metadata } from "next";
import { ConsoleNav } from "@/components/console-nav";
import { ConsoleRequests } from "@/components/console-requests";
import { requireAccount } from "@/features/presentation/auth/require-account";
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
  await requireAccount("/console/requests");
  const [entries, releases] = await Promise.all([
    listTaxonomyRequestQueue(),
    listPendingCommunityPayouts(),
  ]);

  return (
    <>
      <ConsoleNav current="requests" />
      <ConsoleRequests
        entries={entries.ok ? entries.data : null}
        releases={releases.ok ? releases.data : null}
      />
    </>
  );
}
