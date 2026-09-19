import type { Metadata } from "next";
import Link from "next/link";
import { FixtureNotice } from "@/components/fixture-notice";
import { HuntWorkspace } from "@/components/hunt-workspace";
import { HunterOffice } from "@/components/hunter-office";
import { UiStatus } from "@/components/ui-status";
import { fixtureNow, readPreviewState } from "@/features/marketplace/fixture-preview";
import { listClaims, listHunts } from "@/features/marketplace/hunt-source";

export const metadata: Metadata = {
  title: "Hunt | VAULTIX",
  description: "Find academic resource bounties to fulfil and track your claims.",
};

interface ClaimsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ClaimsPage({ searchParams }: ClaimsPageProps) {
  const params = await searchParams;
  const preview = readPreviewState(params["preview"]);
  const hunts = listHunts(preview);
  const claims = listClaims(preview);

  return (
    <div className="page-bare">
      <FixtureNotice screen="The Hunt workspace" />
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
