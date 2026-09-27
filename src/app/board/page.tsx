import type { Metadata } from "next";
import Link from "next/link";
import { BoardViewToggle } from "@/components/board-view-toggle";
import { HuntersWall } from "@/components/hunters-wall";
import { UiStatus } from "@/components/ui-status";
import { WantedBoard } from "@/components/wanted-board";
import type { MarketplaceTaxonomy } from "@/contracts/marketplace";
import { parseBoardFilters, toListWantedQuery } from "@/features/marketplace/filters";
import { listWanted, marketplaceNow } from "@/features/marketplace/wanted-source";
import { huntersHref, parseHuntersParams } from "@/features/presentation/hunters-params";
import { listPublicHunters } from "@/modules/profiles/loaders/hunters-operations";
import { loadMarketplaceTaxonomy } from "@/modules/taxonomy/loaders/taxonomy-read";

export const metadata: Metadata = {
  title: "Wanted Board | VAULTIX",
  description: "Every open academic resource request, searchable by course, campus and session.",
};

/**
 * Reads the caller's session through the public Wanted operation, so it is
 * rendered per request and never enters a shared cache
 * (context/code-standards.md).
 */
export const dynamic = "force-dynamic";

interface BoardPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The catalogue the filter rail offers.
 *
 * A failure here does not cost the reader the Board. The results are a
 * different read, and a rail with no options is worth less than a Board with
 * no rail, so the taxonomy-backed selects are withdrawn and the rail says why
 * rather than offering empty dropdowns.
 */
async function readFilterCatalogue(): Promise<MarketplaceTaxonomy | null> {
  try {
    const result = await loadMarketplaceTaxonomy();

    return result.ok ? result.data : null;
  } catch {
    // The reason belongs in server logs, never in a page a browser reads.
    return null;
  }
}

/**
 * The Board is the marketplace's discovery surface.
 *
 * Filter state lives in the URL rather than in component state, so the page
 * stays server-rendered, a filtered view is linkable, and the back button
 * moves between views the reader actually saw. The URL values are translated
 * into the published `ListWantedQuery` and sent to the server, which selects
 * and orders the rows: nothing on this page filters a list it was given.
 *
 * Browsing metadata is permitted on email verification alone, and this page
 * decides no permission of its own — the read operation refuses, and this
 * only chooses the wording (context/architecture.md).
 */
export default async function BoardPage({ searchParams }: BoardPageProps) {
  const params = await searchParams;
  if (params.view === "hunters") return huntersView(params);

  const filters = parseBoardFilters(params);
  const [board, taxonomy] = await Promise.all([
    listWanted(toListWantedQuery(filters)),
    readFilterCatalogue(),
  ]);

  return (
    <div className="page-bare">
      <BoardViewToggle current="wanted" />
      <div className="panel page-heading">
        <div>
          <h1>Wanted Board</h1>
          <p className="page-heading__lede">
            Browse open academic requests across Malaysian campuses. Back a request or submit a
            claim.
          </p>
        </div>
        <Link className="button button--primary" href="/wanted/new">
          Post a Wanted <span aria-hidden="true">→</span>
        </Link>
      </div>

      {board.status === "signed-out" ? (
        <UiStatus
          kind="restricted"
          heading="Sign in to browse the Board"
          message="Reading what other students need takes a verified email address, so the Board opens once you are signed in."
          action={<Link href="/sign-in">Sign in</Link>}
        />
      ) : board.status === "email-unverified" ? (
        <UiStatus
          kind="restricted"
          heading="Verify your email to browse the Board"
          message="Browsing needs a verified email address and nothing more. Funding a bounty or claiming a request needs institution verification as well, but not for reading."
          action={<Link href="/verify-email">Go to email verification</Link>}
        />
      ) : board.status !== "ready" ? (
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
          taxonomy={taxonomy}
          now={marketplaceNow()}
        />
      )}
    </div>
  );
}

/**
 * The Board's second view: verified members as posters on a wall. It asks
 * the same of the reader as the Wanted view, a verified email, and the read
 * operation refuses anyone else; this only chooses the wording.
 */
async function huntersView(params: Record<string, string | string[] | undefined>) {
  const wanted = parseHuntersParams((name) => params[name]);
  const hunters = await listPublicHunters({ page: wanted.page, pageSize: wanted.per });

  return (
    <div className="page-bare">
      <BoardViewToggle current="hunters" />
      {hunters.ok ? (
        <HuntersWall key={`${hunters.data.pageSize}:${hunters.data.page}`} initial={hunters.data} />
      ) : (
        <>
          <div className="panel page-heading">
            <div>
              <h1>Hunters on the Board</h1>
              <p className="page-heading__lede">
                Verified students who hunt and back bounties. Open a poster to see their profile.
              </p>
            </div>
          </div>
          {hunters.code === "AUTH_REQUIRED" ? (
            <UiStatus
              kind="restricted"
              heading="Sign in to see the Hunters"
              message="The Hunters are members, so the wall opens once you are signed in with a verified email address."
              action={
                <Link href={`/sign-in?next=${encodeURIComponent(huntersHref(wanted))}`}>
                  Sign in
                </Link>
              }
            />
          ) : hunters.code === "EMAIL_NOT_VERIFIED" ? (
            <UiStatus
              kind="restricted"
              heading="Verify your email to see the Hunters"
              message="Seeing other members needs a verified email address and nothing more."
              action={<Link href="/verify-email">Go to email verification</Link>}
            />
          ) : (
            <UiStatus
              kind="offline"
              heading="The Hunters could not be loaded"
              message="This is not a problem with your account, and nothing has been changed. Try again shortly."
              action={<Link href={huntersHref(wanted)}>Try again</Link>}
            />
          )}
        </>
      )}
    </div>
  );
}
