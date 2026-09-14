import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FixtureNotice } from "@/components/fixture-notice";
import { UiStatus } from "@/components/ui-status";
import { WantedDetail } from "@/components/wanted-detail";
import {
  marketplaceNow,
  readPreviewState,
  readSimilarWanted,
  readWanted,
} from "@/features/marketplace/wanted-source";

export const metadata: Metadata = {
  title: "Wanted | VAULTIX",
};

interface WantedDetailPageProps {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * One Wanted request.
 *
 * An unknown identifier is a 404 rather than an error state: a mistyped or
 * stale address is not a failure of the marketplace, and rendering "something
 * went wrong" for it would send the reader looking for a problem that is not
 * there.
 */
export default async function WantedDetailPage({ params, searchParams }: WantedDetailPageProps) {
  const { id } = await params;
  const preview = readPreviewState((await searchParams)["preview"]);
  const result = readWanted(id, preview);

  if (result.status === "ready" && result.data === null) {
    notFound();
  }

  return (
    <>
      <FixtureNotice screen="This Wanted request" />

      <p className="back-link">
        <Link href="/board">Back to the Wanted Board</Link>
      </p>

      {result.status === "unavailable" ? (
        <UiStatus
          kind="offline"
          heading="This Wanted could not be loaded"
          message="This is not a problem with your account, and nothing about the request has changed. Try again shortly."
          action={<Link href="/board">Open the Wanted Board</Link>}
        />
      ) : result.data === null ? null : (
        <WantedDetail
          wanted={result.data}
          similar={readSimilarWanted(result.data)}
          now={marketplaceNow()}
        />
      )}
    </>
  );
}
