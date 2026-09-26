import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { UiStatus } from "@/components/ui-status";
import { WantedDetail } from "@/components/wanted-detail";
import { readAccount } from "@/features/presentation/auth/require-account";
import {
  marketplaceNow,
  readSimilarWanted,
  readWanted,
} from "@/features/marketplace/wanted-source";

export const metadata: Metadata = {
  title: "Wanted | VAULTIX",
};

/**
 * Reads the caller's session through the public Wanted operation, so it is
 * rendered per request and never enters a shared cache
 * (context/code-standards.md).
 */
export const dynamic = "force-dynamic";

interface WantedDetailPageProps {
  readonly params: Promise<{ id: string }>;
}

/**
 * One Wanted request, by its opaque public identifier.
 *
 * An unknown identifier is the real not-found page rather than an error state:
 * a mistyped or withdrawn address is not a failure of the marketplace, and
 * rendering "something went wrong" for it would send the reader looking for a
 * problem that is not there. A request that exists but cannot be read right
 * now is the opposite case and says so.
 *
 * Everything rendered comes from the published detail: a safe display name,
 * the two trust states kept separate, the bounty in integer sen, the
 * snapshotted fee rate and policy version, and the public activity. No
 * contributor identity, email address, ledger row, provider reference or file
 * metadata is in that payload, and none is asked for here.
 */
export default async function WantedDetailPage({ params }: WantedDetailPageProps) {
  const { id } = await params;
  // Independent reads sharing the request's one Auth check: run together.
  const [result, accountOutcome] = await Promise.all([readWanted(id), readAccount()]);

  if (result.status === "not-found") {
    notFound();
  }

  const similar = result.status === "ready" ? await readSimilarWanted(result.data) : [];
  const account = accountOutcome.kind === "account" ? accountOutcome.account : null;

  return (
    <div className="page-bare">
      <p className="back-link">
        <Link className="button button--ghost" href="/board">
          <span aria-hidden="true">←</span> Back to the Wanted Board
        </Link>
      </p>

      {result.status === "signed-out" ? (
        <UiStatus
          kind="restricted"
          heading="Sign in to read this request"
          message="Reading what other students need takes a verified email address, so the request opens once you are signed in."
          action={<Link href="/sign-in">Sign in</Link>}
        />
      ) : result.status === "email-unverified" ? (
        <UiStatus
          kind="restricted"
          heading="Verify your email to read this request"
          message="Browsing needs a verified email address and nothing more. Funding this bounty or claiming it needs institution verification as well, but not for reading."
          action={<Link href="/verify-email">Go to email verification</Link>}
        />
      ) : result.status !== "ready" ? (
        <UiStatus
          kind="offline"
          heading="This Wanted could not be loaded"
          message="This is not a problem with your account, and nothing about the request has changed. Try again shortly."
          action={<Link href="/board">Open the Wanted Board</Link>}
        />
      ) : (
        <WantedDetail
          wanted={result.data}
          similar={similar}
          now={marketplaceNow()}
          account={account}
        />
      )}
    </div>
  );
}
