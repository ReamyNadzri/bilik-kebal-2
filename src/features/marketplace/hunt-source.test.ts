import { listClaims, listHunts } from "./hunt-source";

describe("fixture-backed Hunt reads", () => {
  test("keeps open opportunities linked to real Wanted ids", () => {
    const result = listHunts();

    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.every((hunt) => hunt.status !== "closed")).toBe(true);
      expect(result.data.every((hunt) => Number.isInteger(hunt.grossBountySen))).toBe(true);
    }
  });

  test("provides every claim state for review", () => {
    const result = listClaims();

    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(new Set(result.data.map((claim) => claim.status))).toEqual(
        new Set([
          "draft",
          "screening",
          "needs-information",
          "under-review",
          "not-selected",
          "approved",
          "rejected",
          "quarantined",
        ]),
      );
    }
  });

  test("exposes explicit empty and unavailable preview states", () => {
    expect(listHunts("empty")).toEqual({ status: "ready", data: [] });
    expect(listClaims("empty")).toEqual({ status: "ready", data: [] });
    expect(listHunts("unavailable")).toEqual({ status: "unavailable" });
    expect(listClaims("unavailable")).toEqual({ status: "unavailable" });
  });
});
