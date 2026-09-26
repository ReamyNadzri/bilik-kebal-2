import type { Metadata } from "next";
import Link from "next/link";
import { HuntWorkspace } from "@/components/hunt-workspace";
import { HunterOffice } from "@/components/hunter-office";
import { UiStatus } from "@/components/ui-status";
import { readAccount } from "@/features/presentation/auth/require-account";
import { getRequestSupabaseClient, getRequestUser } from "@/lib/supabase/server";
import { fixtureNow, readPreviewState } from "@/features/marketplace/fixture-preview";
import { listClaims, listHunts } from "@/features/marketplace/hunt-source";
import { listWanted } from "@/features/marketplace/wanted-source";
import type { ClaimSummary, HuntOpportunity } from "@/features/marketplace/types";
import { HunterClaimsReadService } from "@/modules/claims/services/hunter-claims-read-service";

export const metadata: Metadata = {
  title: "Hunt | VAULTIX",
  description: "Find academic resource bounties to fulfil and track your claims.",
};

export const dynamic = "force-dynamic";

interface ClaimsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The signed-in Hunter's own claims, or none. A failed read shows an empty
 * history rather than failing the page: the open hunts are still worth seeing.
 */
async function readOwnClaims(): Promise<ClaimSummary[]> {
  try {
    const {
      data: { user },
    } = await getRequestUser();
    if (!user) return [];
    const readService = new HunterClaimsReadService(await getRequestSupabaseClient());
    return await readService.listHunterClaims(user.id);
  } catch {
    return [];
  }
}

export default async function ClaimsPage({ searchParams }: ClaimsPageProps) {
  const params = await searchParams;
  const preview = readPreviewState(params["preview"]);
  const nowInstant = new Date().toISOString();

  // If explicitly in preview mode, use the preview harness
  if (preview !== null) {
    const hunts = listHunts(preview);
    const claims = listClaims(preview);

    return (
      <div className="page-bare">
        <HunterOffice claims={claims.status === "ready" ? claims.data : null} />

        {hunts.status === "unavailable" || claims.status === "unavailable" ? (
          <UiStatus
            kind="offline"
            heading="Hunt could not be loaded"
            message="The opportunity and claim ledgers are temporarily unavailable. Nothing has been submitted or changed."
            action={<Link href="/claims">Try again</Link>}
          />
        ) : (
          <HuntWorkspace hunts={hunts.data} claims={claims.data} now={fixtureNow()} />
        )}
      </div>
    );
  }

  // Real authenticated session. The three reads are independent and share the
  // request's one Auth check, so they run together rather than in turn.
  // Open hunts are the Board's academic requests, read through the same
  // published operation (bounty totals from the ledger, never defaults).
  const [outcome, board, ownClaims] = await Promise.all([
    readAccount(),
    listWanted({ kind: "academic", sort: "newest" }),
    readOwnClaims(),
  ]);
  const account = outcome.kind === "account" ? outcome.account : null;
  const hunts: HuntOpportunity[] =
    board.status === "ready"
      ? board.data.map((wanted) => ({
          ...wanted,
          activeClaimCount: 0,
          eligibility: "institution-verified" as const,
        }))
      : [];

  // Live claims are shown only beside a loaded account, as before.
  const claims: ClaimSummary[] = account ? ownClaims : [];

  return (
    <div className="page-bare">
      <HunterOffice claims={account ? claims : null} account={account} />

      {!account ? (
        <div className="panel">
          <UiStatus
            kind="restricted"
            heading="Sign in to submit and track claims"
            message="You can browse active bounties below. To claim a bounty and earn the reward, please sign in with your student account."
            action={<Link href="/sign-in?next=/claims">Sign in</Link>}
          />
        </div>
      ) : null}

      <HuntWorkspace hunts={hunts} claims={claims} now={nowInstant} />
    </div>
  );
}
