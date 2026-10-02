import type { BackingRefundState, ClosedBacking, Sen } from "@/contracts/marketplace";

/** One row of public.list_own_backed_wanted (migration 202610200005). */
export interface BackedWantedRecord {
  publicId: string;
  title: string;
  /** The Wanted's status: open, reviewing, expired, fulfilled, closed, withdrawn, draft... */
  status: string;
  /** Withdrawn by its poster. */
  withdrawn: boolean;
  /** Removed by the Owner. */
  removed: boolean;
  backedAt: string;
  /** Contribution + fee over the member's refund tasks for it. */
  refundSen: number;
  refundState: BackingRefundState;
}

/**
 * The closed-out view of a backing, or null while it is still a live card.
 * A Wanted is closed out for its Backer when it was withdrawn, removed or
 * expired, or when any refund is owed on it (a payment confirmed after it
 * closed): the card would otherwise hide the refund.
 */
export function closedBacking(record: BackedWantedRecord): ClosedBacking | null {
  const reason: ClosedBacking["reason"] | null = record.removed
    ? "removed"
    : record.withdrawn || record.status === "withdrawn"
      ? "withdrawn"
      : record.status === "expired"
        ? "expired"
        : record.refundState !== "none" || record.status === "draft"
          ? "closed"
          : null;
  if (reason === null) return null;
  return {
    publicId: record.publicId,
    title: record.title,
    reason,
    refundState: record.refundState,
    refundSen: record.refundSen as Sen,
    backedAt: record.backedAt,
  };
}
