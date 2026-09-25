import type { WantedKind, WantedThreadState } from "@/contracts/marketplace";

/** Days a closed thread stays readable before its messages are deleted. */
export const THREAD_RETENTION_DAYS = 7;
/** Days without a message before a free community thread closes itself. */
export const THREAD_STALE_DAYS = 30;

const DAY = 86_400_000;
const CLOSED = new Set(["closed", "fulfilled", "expired"]);

export interface WantedThreadRow {
  kind: WantedKind;
  is_free: boolean;
  status: string;
  closes_at: string | null;
  thread_closed_at: string | null;
  thread_auto_closed: boolean;
  thread_purged_at: string | null;
  thread_reply_count: number;
}

function plusDays(instant: string, days: number): string {
  return new Date(Date.parse(instant) + days * DAY).toISOString();
}

/**
 * What the reader is told about a thread's retention. The database job
 * (`private.purge_closed_wanted_threads`) is authoritative; this mirrors its
 * rules closely enough to state a date, and returns null where the job would
 * wait on something the reader cannot see (a release, a refund, an appeal).
 */
export function wantedThreadState(row: WantedThreadRow, bountySen: number): WantedThreadState {
  const closedAt = CLOSED.has(row.status) ? row.thread_closed_at : null;
  const community = row.kind !== "academic";
  const settled = !community || row.is_free || bountySen === 0 || row.status === "fulfilled";
  const vanishesAt =
    closedAt && !row.thread_purged_at && settled ? plusDays(closedAt, THREAD_RETENTION_DAYS) : null;
  let reopenUntil: string | null = null;
  if (community && row.status === "closed" && closedAt && !row.thread_purged_at && row.closes_at) {
    const limit = Math.min(
      Date.parse(plusDays(closedAt, THREAD_RETENTION_DAYS)),
      Date.parse(row.closes_at),
    );
    reopenUntil = new Date(limit).toISOString();
  }
  return {
    replyCount: row.thread_reply_count,
    closedAt,
    autoClosed: closedAt !== null && row.thread_auto_closed,
    vanishesAt,
    reopenUntil,
    clearedAt: row.thread_purged_at,
  };
}
