import type { Metadata } from "next";
import Link from "next/link";
import { HuntWorkspace } from "@/components/hunt-workspace";
import { HunterOffice } from "@/components/hunter-office";
import { UiStatus } from "@/components/ui-status";
import { readAccount } from "@/features/presentation/auth/require-account";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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

  // Real authenticated session:
  const outcome = await readAccount();
  const account = outcome.kind === "account" ? outcome.account : null;

  // Open hunts are the Board's academic requests, read through the same
  // published operation (bounty totals from the ledger, never defaults).
  const board = await listWanted({ kind: "academic", sort: "newest" });
  const hunts: HuntOpportunity[] =
    board.status === "ready"
      ? board.data.map((wanted) => ({
          ...wanted,
          activeClaimCount: 0,
          eligibility: "institution-verified" as const,
        }))
      : [];

  // Load live claims for this user if authenticated
  let claims: ClaimSummary[] = [];
  if (account) {
    try {
      const supabase = await createSupabaseServerClient();
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        const readService = new HunterClaimsReadService(supabase);
        claims = await readService.listHunterClaims(auth.user.id);
      }
    } catch {
      claims = [];
    }
  }

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
