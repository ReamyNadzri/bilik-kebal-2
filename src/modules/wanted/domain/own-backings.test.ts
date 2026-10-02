import { describe, expect, test } from "vitest";
import { closedBacking, type BackedWantedRecord } from "./own-backings";

const record = (overrides: Partial<BackedWantedRecord>): BackedWantedRecord => ({
  publicId: "p-1",
  title: "Past year papers for MAT183",
  status: "open",
  withdrawn: false,
  removed: false,
  backedAt: "2026-10-03T01:00:00Z",
  refundSen: 0,
  refundState: "none",
  ...overrides,
});

describe("closedBacking", () => {
  test("a live Wanted with no refund stays a card", () => {
    expect(closedBacking(record({}))).toBeNull();
    expect(closedBacking(record({ status: "fulfilled" }))).toBeNull();
  });

  test("names who closed it and carries the refund", () => {
    expect(
      closedBacking(
        record({ status: "withdrawn", withdrawn: true, refundState: "pending", refundSen: 2200 }),
      ),
    ).toEqual({
      publicId: "p-1",
      title: "Past year papers for MAT183",
      reason: "withdrawn",
      refundState: "pending",
      refundSen: 2200,
      backedAt: "2026-10-03T01:00:00Z",
    });
    expect(closedBacking(record({ status: "withdrawn", removed: true }))?.reason).toBe("removed");
    expect(closedBacking(record({ status: "expired", refundState: "refunded" }))?.reason).toBe(
      "expired",
    );
  });

  test("a refund on a Wanted that is otherwise done reads as closed", () => {
    // A payment confirmed after the Wanted was fulfilled is refunded.
    const item = closedBacking(record({ status: "fulfilled", refundState: "pending" }));
    expect(item?.reason).toBe("closed");
  });
});
