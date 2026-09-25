import { describe, expect, it } from "vitest";
import { wantedThreadState, type WantedThreadRow } from "./wanted-thread";

const closedAt = "2026-09-20T00:00:00.000Z";
const base: WantedThreadRow = {
  kind: "missing_item",
  is_free: true,
  status: "closed",
  closes_at: "2026-10-20T00:00:00.000Z",
  thread_closed_at: closedAt,
  thread_auto_closed: false,
  thread_purged_at: null,
  thread_reply_count: 4,
};

describe("wantedThreadState", () => {
  it("schedules a found free item 7 days after it closed, reopenable until then", () => {
    expect(wantedThreadState(base, 0)).toEqual({
      replyCount: 4,
      closedAt,
      autoClosed: false,
      vanishesAt: "2026-09-27T00:00:00.000Z",
      reopenUntil: "2026-09-27T00:00:00.000Z",
      clearedAt: null,
    });
  });

  it("has no clock while the thread is open or reviewing", () => {
    for (const status of ["open", "reviewing"]) {
      const state = wantedThreadState({ ...base, status, thread_closed_at: null }, 0);
      expect(state).toMatchObject({ closedAt: null, vanishesAt: null, reopenUntil: null });
    }
  });

  it("gives no date for a paid request until its bounty is released", () => {
    const paid = { ...base, is_free: false };
    expect(wantedThreadState(paid, 500).vanishesAt).toBeNull();
    expect(wantedThreadState({ ...paid, status: "fulfilled" }, 500).vanishesAt).toBe(
      "2026-09-27T00:00:00.000Z",
    );
  });

  it("stops reopening at the request's own end", () => {
    const ending = { ...base, closes_at: "2026-09-22T00:00:00.000Z" };
    expect(wantedThreadState(ending, 0).reopenUntil).toBe("2026-09-22T00:00:00.000Z");
  });

  it("never offers a reopen for an academic bounty or a cleared thread", () => {
    expect(wantedThreadState({ ...base, kind: "academic" }, 0).reopenUntil).toBeNull();
    const cleared = wantedThreadState({ ...base, thread_purged_at: "2026-09-27T03:17:00.000Z" }, 0);
    expect(cleared).toMatchObject({
      vanishesAt: null,
      reopenUntil: null,
      clearedAt: "2026-09-27T03:17:00.000Z",
    });
  });

  it("reports an auto-close only while closed", () => {
    expect(wantedThreadState({ ...base, thread_auto_closed: true }, 0).autoClosed).toBe(true);
  });
});
