import type { Metadata } from "next";
import Link from "next/link";
import { FixtureNotice } from "@/components/fixture-notice";
import { UiStatus } from "@/components/ui-status";
import { WantedBoard } from "@/components/wanted-board";
import { parseBoardFilters } from "@/features/marketplace/filters";
import {
  countAllWanted,
  listWanted,
  marketplaceNow,
  readPreviewState,
} from "@/features/marketplace/wanted-source";

export const metadata: Metadata = {
  title: "Wanted Board | VAULTIX",
  description: "Every open academic resource request, searchable by course, campus and session.",
};

interface BoardPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The Board is the marketplace's discovery surface.
 *
 * Filter state lives in the URL rather than in component state, so the page
 * stays server-rendered, a filtered view is linkable, and the back button
 * moves between views the reader actually saw.
 *
 * Browsing metadata is permitted on email verification alone, and this page
 * decides no permission of its own: when the authoritative capability view
 * model arrives, what a viewer may do with a request is read from it rather
 * than inferred here (context/architecture.md).
 */
export default async function BoardPage({ searchParams }: BoardPageProps) {
  const params = await searchParams;
  const preview = readPreviewState(params["preview"]);
  const filters = parseBoardFilters(params);
  const board = listWanted(filters, preview);

  return (
    <>
      <FixtureNotice screen="The Wanted Board" />

      <h1>Wanted Board</h1>

      {board.status === "unavailable" ? (
        <UiStatus
          kind="offline"
          heading="The Wanted Board could not be loaded"
          message="This is not a problem with your account, and no request has been changed. Try again shortly."
          action={<Link href="/board">Try again</Link>}
        />
      ) : (
        <WantedBoard
          filters={filters}
          items={board.data}
          total={countAllWanted(preview)}
          now={marketplaceNow()}
        />
      )}
    </>
  );
}
