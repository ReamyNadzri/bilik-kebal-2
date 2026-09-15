import { describe, expect, it } from "vitest";
import type { WantedSummary } from "@/contracts/marketplace";
import { parseWantedListQuery, sortWantedSummaries } from "./wanted-read-query";

const item = (id: string, bounty: number, postedAt: string, closesAt: string): WantedSummary => ({
  id,
  title: id,
  courseCode: "CSC510",
  courseName: "Computing",
  courseId: "c",
  campus: "Shah Alam",
  campusId: "ca",
  resourceType: "Notes",
  resourceTypeId: "rt",
  session: "2026/1",
  sessionId: "s",
  grossBountySen: bounty as never,
  backerCount: 1,
  status: "open",
  postedAt,
  closesAt,
});

describe("Wanted Board query", () => {
  it("rejects unknown status and sort values", () => {
    expect(parseWantedListQuery(new URLSearchParams("status=paid&sort=popular"))).toMatchObject({
      ok: false,
      code: "VALIDATION_ERROR",
    });
  });

  it("sorts highest bounty with newest as a stable tie breaker", () => {
    const rows = [
      item("old", 1000, "2026-09-01T00:00:00Z", "2026-09-20T00:00:00Z"),
      item("new", 1000, "2026-09-02T00:00:00Z", "2026-09-21T00:00:00Z"),
      item("high", 2000, "2026-08-01T00:00:00Z", "2026-09-30T00:00:00Z"),
    ];
    expect(sortWantedSummaries(rows, "highest_bounty").map(({ id }) => id)).toEqual([
      "high",
      "new",
      "old",
    ]);
  });

  it("sorts ending soon by closing instant", () => {
    const rows = [
      item("later", 1000, "2026-09-01T00:00:00Z", "2026-09-30T00:00:00Z"),
      item("soon", 1000, "2026-09-02T00:00:00Z", "2026-09-20T00:00:00Z"),
    ];
    expect(sortWantedSummaries(rows, "ending_soon").map(({ id }) => id)).toEqual(["soon", "later"]);
  });
});
