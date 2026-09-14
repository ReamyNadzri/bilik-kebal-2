import type { Metadata } from "next";
import Link from "next/link";
import { FixtureNotice } from "@/components/fixture-notice";
import { HuntWorkspace } from "@/components/hunt-workspace";
import { UiStatus } from "@/components/ui-status";
import { listClaims, listHunts } from "@/features/marketplace/hunt-source";
import { marketplaceNow, readPreviewState } from "@/features/marketplace/wanted-source";

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
    <>
      <FixtureNotice screen="The Hunt workspace" />
      <div className="hunt-title">
        <h1>Hunt</h1>
        <p>
          Choose a live bounty you can answer, then follow each claim through screening and Sheriff
          review.
        </p>
      </div>

      {hunts.status === "unavailable" || claims.status === "unavailable" ? (
        <UiStatus
          kind="offline"
          heading="Hunt could not be loaded"
          message="The opportunity and claim ledgers are temporarily unavailable. Nothing has been submitted or changed."
          action={<Link href="/claims">Try again</Link>}
        />
      ) : (
        <HuntWorkspace hunts={hunts.data} claims={claims.data} now={marketplaceNow()} />
      )}
    </>
  );
}
