import type { Metadata } from "next";
import Link from "next/link";
import { CampusMap } from "@/components/campus-map";
import { UiStatus } from "@/components/ui-status";
import { readAccount } from "@/features/presentation/auth/require-account";
import { listCampusRegions } from "@/modules/wanted/loaders/wanted-operations";

export const metadata: Metadata = {
  title: "Explore Map | VAULTIX",
  description: "See where students are asking for academic resources, campus by campus.",
};

/** Live counts depend on the viewer; rendered per request. */
export const dynamic = "force-dynamic";

/**
 * The Explore Map, from live campus regions. Campus names and whether a region
 * is open are public; open-request counts and bounty totals need a verified
 * email, the same bar as browsing the Board.
 */
export default async function ExploreMapPage() {
  const [regions, outcome] = await Promise.all([listCampusRegions(), readAccount()]);
  const showCounts = outcome.kind === "account" && outcome.account.trust.email === "verified";

  if (!regions.ok) {
    return (
      <UiStatus
        kind="offline"
        heading="The campus map could not be loaded"
        message="Campus regions are temporarily unavailable. Nothing has changed. Try again shortly."
        action={<Link href="/map">Try again</Link>}
      />
    );
  }

  if (regions.data.length === 0) {
    return (
      <UiStatus
        kind="empty"
        heading="No campuses are listed yet"
        message="Campuses appear here once they are added to the reviewed institutional records."
        action={<Link href="/board">Browse the Wanted Board</Link>}
      />
    );
  }

  return (
    <div className="page-bare">
      <CampusMap campuses={regions.data} showCounts={showCounts} />
    </div>
  );
}
