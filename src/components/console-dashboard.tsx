import Link from "next/link";

/** Items waiting in a queue; `null` when the count is not available to this viewer. */
type Count = number | null;

export interface ConsoleDashboardProps {
  /** Pending institution verification requests, counted on the server. */
  readonly verificationCount: number;
  /** The other queues, counted on the server in the same request. */
  readonly counts: {
    readonly claims: Count;
    readonly appeals: Count;
    readonly payouts: Count;
    readonly refunds: Count;
  };
}

/**
 * The console at a glance: one tile per queue with the number waiting and a
 * link to work it. Each count comes from the same operation the queue itself
 * uses, so a tile never shows work the reviewer cannot see.
 *
 * The counts arrive with the page. They used to be four browser requests sent
 * after it loaded, each one another round trip that checked the session
 * again, so the tiles sat on "…" well after everything else had rendered.
 */
export function ConsoleDashboard({ verificationCount, counts }: ConsoleDashboardProps) {
  const tiles: readonly { label: string; value: Count; href: string; hint: string }[] = [
    {
      label: "Institution verifications",
      value: verificationCount,
      href: "#verification-queue",
      hint: "Students waiting for a verification decision",
    },
    {
      label: "Claims to review",
      value: counts.claims,
      href: "/console/claims",
      hint: "Quarantined claims waiting for a Sheriff",
    },
    {
      label: "Appeals",
      value: counts.appeals,
      href: "/console/appeals",
      hint: "Rejected claims appealed within 7 days",
    },
    {
      label: "Payouts to record",
      value: counts.payouts,
      href: "/console/operations",
      hint: "Approved winners waiting for payment",
    },
    {
      label: "Refunds to record",
      value: counts.refunds,
      href: "/console/operations",
      hint: "Contributions to expired bounties",
    },
  ];

  return (
    <section aria-labelledby="console-overview-heading" className="console-dashboard">
      <h2 id="console-overview-heading" className="visually-hidden">
        Queues at a glance
      </h2>
      <ul className="console-tiles">
        {tiles.map((tile) => (
          <li key={tile.label}>
            {/* Not prefetched: each queue is rendered per request on arrival. */}
            <Link className="console-tile" href={tile.href} prefetch={false}>
              <span className="console-tile__value numeric">
                {tile.value === null ? "—" : tile.value}
              </span>
              <span className="console-tile__label">{tile.label}</span>
              <span className="console-tile__hint">
                {tile.value === null ? "Not available to your role" : tile.hint}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
