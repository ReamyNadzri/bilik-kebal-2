import type { Metadata } from "next";
import Link from "next/link";
import { DownloadButton } from "@/components/download-button";
import { Tabs } from "@/components/tabs";
import { UiStatus } from "@/components/ui-status";
import { WantedCard } from "@/components/wanted-card";
import { WantedPoster } from "@/components/wanted-poster";
import { marketplaceNow } from "@/features/marketplace/wanted-source";
import { listArchivedWanted, listOwnLibrary } from "@/modules/wanted/loaders/wanted-operations";

export const metadata: Metadata = {
  title: "Archive | VAULTIX",
  description: "Fulfilled and resolved requests, and the resources you can download.",
};

/** Depends on the viewer's session and entitlements; never cached. */
export const dynamic = "force-dynamic";

/**
 * The Archive: every fulfilled or resolved Wanted, and the viewer's own
 * library of approved resources. A download is always a fresh, short-lived
 * signed link issued after the entitlement is checked again on the server.
 */
export default async function ArchivePage() {
  const [archive, library] = await Promise.all([listArchivedWanted(), listOwnLibrary()]);
  const now = marketplaceNow();

  if (!archive.ok && archive.code !== "MARKETPLACE_UNAVAILABLE") {
    return (
      <div className="panel">
        <h1>Archive</h1>
        {archive.code === "AUTH_REQUIRED" ? (
          <UiStatus
            kind="restricted"
            heading="Sign in to browse the Archive"
            message="The Archive lists fulfilled requests for signed-in members with a verified email."
            action={<Link href="/sign-in?next=/archive">Sign in</Link>}
          />
        ) : (
          <UiStatus
            kind="restricted"
            heading="Verify your email to browse the Archive"
            message="Browsing needs a verified email address and nothing more."
            action={<Link href="/verify-email">Go to email verification</Link>}
          />
        )}
      </div>
    );
  }

  const archivePanel = !archive.ok ? (
    <UiStatus
      kind="offline"
      heading="The Archive could not be loaded"
      message="Nothing has changed. Try again shortly."
      action={<Link href="/archive">Try again</Link>}
    />
  ) : archive.data.length === 0 ? (
    <UiStatus
      kind="empty"
      heading="Nothing in the Archive yet"
      message="Requests appear here once a Sheriff approves a claim or the poster marks them resolved."
      action={<Link href="/board">Browse the Wanted Board</Link>}
    />
  ) : (
    <ul className="wanted-grid" aria-label="Archived requests">
      {archive.data.map((wanted) => (
        <WantedCard key={wanted.id} wanted={wanted} now={now} />
      ))}
    </ul>
  );

  const libraryPanel = !library.ok ? (
    <UiStatus
      kind="offline"
      heading="Your library could not be loaded"
      message="Nothing has changed. Try again shortly."
      action={<Link href="/archive">Try again</Link>}
    />
  ) : library.data.length === 0 ? (
    <UiStatus
      kind="empty"
      heading="Your library is empty"
      message="When a Sheriff approves a claim on a request you backed, or on your own free request, the resource appears here."
      action={<Link href="/board">Browse the Wanted Board</Link>}
    />
  ) : (
    <ul className="wanted-grid" aria-label="Your library">
      {library.data.map((item) => (
        <li className="wanted-card" key={item.claimId}>
          <WantedPoster
            wanted={item.wanted}
            now={now}
            className="wanted-card__frame"
            title={
              <h3 className="wanted-card__title">
                <Link href={`/wanted/${item.wanted.id}`} prefetch={false}>
                  {item.wanted.title}
                </Link>
              </h3>
            }
            footer={
              item.revoked ? (
                <p className="locker-card__blocked">Access revoked after a takedown.</p>
              ) : (
                <DownloadButton claimId={item.claimId} label={item.wanted.title} />
              )
            }
          />
        </li>
      ))}
    </ul>
  );

  return (
    <div className="page-bare">
      <header className="panel page-heading">
        <div>
          <h1>Archive</h1>
          <p className="page-heading__lede">
            Fulfilled and resolved requests, and the approved resources you can download.
          </p>
        </div>
      </header>
      <Tabs
        label="Archive sections"
        items={[
          {
            id: "archive",
            label: `Archive${archive.ok ? ` (${archive.data.length})` : ""}`,
            panel: <section className="board-surface">{archivePanel}</section>,
          },
          {
            id: "library",
            label: `My library${library.ok ? ` (${library.data.length})` : ""}`,
            panel: <section className="board-surface">{libraryPanel}</section>,
          },
        ]}
      />
    </div>
  );
}
