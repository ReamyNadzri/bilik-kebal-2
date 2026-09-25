"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export interface ConsoleDashboardProps {
  /** Pending institution verification requests, counted on the server. */
  readonly verificationCount: number;
}

type Count = number | "unavailable" | "loading";

async function count(path: string, pick: (data: unknown) => number): Promise<Count> {
  try {
    const response = await fetch(path, { cache: "no-store" });
    const body = (await response.json()) as { ok: boolean; data?: unknown };
    return response.ok && body.ok ? pick(body.data) : "unavailable";
  } catch {
    return "unavailable";
  }
}

const pending = (data: unknown) =>
  Array.isArray(data)
    ? data.filter((row) => (row as { status?: string }).status === "pending").length
    : 0;

/**
 * The console at a glance: one tile per queue with the number waiting and a
 * link to work it. Each count comes from the same operation the queue itself
 * uses, so a tile never shows work the reviewer cannot see.
 */
export function ConsoleDashboard({ verificationCount }: ConsoleDashboardProps) {
  const [claims, setClaims] = useState<Count>("loading");
  const [appeals, setAppeals] = useState<Count>("loading");
  const [payouts, setPayouts] = useState<Count>("loading");
  const [refunds, setRefunds] = useState<Count>("loading");

  useEffect(() => {
    void count("/api/claims/reviews", (data) => (Array.isArray(data) ? data.length : 0)).then(
      setClaims,
    );
    void count("/api/sheriff/moderation", (data) => {
      const appealsList = (data as { appeals?: unknown[] } | undefined)?.appeals;
      return Array.isArray(appealsList) ? appealsList.length : 0;
    }).then(setAppeals);
    void count("/api/sheriff/payouts", pending).then(setPayouts);
    void count("/api/sheriff/refunds", pending).then(setRefunds);
  }, []);

  const tiles: readonly { label: string; value: Count; href: string; hint: string }[] = [
    {
      label: "Institution verifications",
      value: verificationCount,
      href: "#verification-queue",
      hint: "Students waiting for a verification decision",
    },
    {
      label: "Claims to review",
      value: claims,
      href: "/console/claims",
      hint: "Quarantined claims waiting for a Sheriff",
    },
    {
      label: "Appeals",
      value: appeals,
      href: "/console/appeals",
      hint: "Rejected claims appealed within 7 days",
    },
    {
      label: "Payouts to record",
      value: payouts,
      href: "/console/operations",
      hint: "Approved winners waiting for payment",
    },
    {
      label: "Refunds to record",
      value: refunds,
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
            <Link className="console-tile" href={tile.href}>
              <span className="console-tile__value numeric" aria-live="polite">
                {tile.value === "loading" ? "…" : tile.value === "unavailable" ? "—" : tile.value}
              </span>
              <span className="console-tile__label">{tile.label}</span>
              <span className="console-tile__hint">
                {tile.value === "unavailable" ? "Not available to your role" : tile.hint}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
