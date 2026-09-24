import {
  listFeaturedWanted,
  listWanted,
  marketplaceNow,
  readSimilarWanted,
  readWanted,
} from "./wanted-source";
import { aWanted } from "./test-support/wanted";
import type { WantedDetail } from "@/contracts/marketplace";

const listPublicWanted = vi.hoisted(() => vi.fn());
const readPublicWanted = vi.hoisted(() => vi.fn());

vi.mock("@/modules/wanted/loaders/wanted-operations", () => ({
  listPublicWanted,
  readPublicWanted,
}));

function aDetail(overrides: Partial<WantedDetail> = {}): WantedDetail {
  return {
    ...aWanted(),
    description: "Complete notes covering every chapter.",
    faculty: "Faculty of Computing",
    programme: "Bachelor of Computer Science",
    language: "English",
    tags: ["Final exam"],
    commissioner: {
      publicId: null,
      avatarUrl: null,
      joinedAt: null,
      displayName: "A student", emailVerified: true, institutionVerified: true },
    feeRateBasisPoints: 1000,
    policyVersion: "2026-09-15.1",
    activity: [],
    similarIds: [],
    ...overrides,
  };
}

beforeEach(() => {
  listPublicWanted.mockReset().mockResolvedValue({ ok: true, data: [aWanted()] });
  readPublicWanted.mockReset().mockResolvedValue({ ok: true, data: aDetail() });
});

describe("listing the Board", () => {
  test("passes the contract query straight to the published operation", async () => {
    await listWanted({ query: "notes", campusId: "campus-1", sort: "highest_bounty" });

    expect(listPublicWanted).toHaveBeenCalledWith({
      query: "notes",
      campusId: "campus-1",
      sort: "highest_bounty",
    });
  });

  test("answers with the summaries the operation returned", async () => {
    const result = await listWanted({});

    expect(result).toEqual({ status: "ready", data: [aWanted()] });
  });

  test("treats a successful empty Board as ready, never as unavailable", async () => {
    listPublicWanted.mockResolvedValue({ ok: true, data: [] });

    expect(await listWanted({})).toEqual({ status: "ready", data: [] });
  });

  test.each([
    ["AUTH_REQUIRED", "signed-out"],
    ["EMAIL_NOT_VERIFIED", "email-unverified"],
    ["MARKETPLACE_UNAVAILABLE", "unavailable"],
    ["VALIDATION_ERROR", "unavailable"],
  ] as const)("reports %s as %s", async (code, status) => {
    listPublicWanted.mockResolvedValue({ ok: false, code, message: "no" });

    expect(await listWanted({})).toEqual({ status });
  });

  test("reports a loader that throws as unavailable rather than failing the page", async () => {
    listPublicWanted.mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:54322"));

    expect(await listWanted({})).toEqual({ status: "unavailable" });
  });

  test("never lets a refusal message reach the screen as data", async () => {
    listPublicWanted.mockResolvedValue({
      ok: false,
      code: "MARKETPLACE_UNAVAILABLE",
      message: "connect ECONNREFUSED 127.0.0.1:54322",
    });

    expect(JSON.stringify(await listWanted({}))).not.toMatch(/ECONNREFUSED/);
  });
});

describe("the homepage selection", () => {
  test("asks for the newest requests", async () => {
    await listFeaturedWanted();

    expect(listPublicWanted).toHaveBeenCalledWith({ sort: "newest" });
  });

  test("shows only a small selection of them", async () => {
    listPublicWanted.mockResolvedValue({
      ok: true,
      data: [1, 2, 3, 4, 5, 6].map((n) => aWanted({ id: `wanted-${n}` })),
    });

    const result = await listFeaturedWanted(4);

    expect(result.status === "ready" && result.data).toHaveLength(4);
  });

  test("keeps the order the operation decided rather than reordering it here", async () => {
    listPublicWanted.mockResolvedValue({
      ok: true,
      data: [aWanted({ id: "second" }), aWanted({ id: "first" })],
    });

    const result = await listFeaturedWanted();

    expect(result.status === "ready" && result.data.map((w) => w.id)).toEqual(["second", "first"]);
  });

  test("passes a refusal through unchanged", async () => {
    listPublicWanted.mockResolvedValue({ ok: false, code: "AUTH_REQUIRED", message: "no" });

    expect(await listFeaturedWanted()).toEqual({ status: "signed-out" });
  });
});

describe("reading one Wanted", () => {
  test("asks by the opaque public identifier it was given", async () => {
    await readWanted("csc510-final-exam-notes");

    expect(readPublicWanted).toHaveBeenCalledWith("csc510-final-exam-notes");
  });

  test("answers with the detail the operation returned", async () => {
    expect(await readWanted("any")).toEqual({ status: "ready", data: aDetail() });
  });

  test("reports an unknown request as not found, never as a failure", async () => {
    readPublicWanted.mockResolvedValue({ ok: false, code: "WANTED_NOT_FOUND", message: "no" });

    expect(await readWanted("missing")).toEqual({ status: "not-found" });
  });

  test.each([
    ["AUTH_REQUIRED", "signed-out"],
    ["EMAIL_NOT_VERIFIED", "email-unverified"],
    ["MARKETPLACE_UNAVAILABLE", "unavailable"],
  ] as const)("reports %s as %s", async (code, status) => {
    readPublicWanted.mockResolvedValue({ ok: false, code, message: "no" });

    expect(await readWanted("any")).toEqual({ status });
  });

  test("reports a loader that throws as unavailable rather than failing the page", async () => {
    readPublicWanted.mockRejectedValue(new Error("boom"));

    expect(await readWanted("any")).toEqual({ status: "unavailable" });
  });
});

describe("the requests suggested beside a Wanted", () => {
  test("reads nothing when the detail supplied no identifiers", async () => {
    expect(await readSimilarWanted(aDetail({ similarIds: [] }))).toEqual([]);
    expect(readPublicWanted).not.toHaveBeenCalled();
  });

  test("resolves each supplied identifier to its summary", async () => {
    readPublicWanted.mockImplementation(async (id: string) => ({
      ok: true,
      data: aDetail({ id, title: `Request ${id}` }),
    }));

    const similar = await readSimilarWanted(aDetail({ similarIds: ["one", "two"] }));

    expect(similar.map((wanted) => wanted.id)).toEqual(["one", "two"]);
  });

  test("drops an identifier that no longer resolves rather than failing the page", async () => {
    readPublicWanted.mockImplementation(async (id: string) =>
      id === "gone"
        ? { ok: false, code: "WANTED_NOT_FOUND", message: "no" }
        : { ok: true, data: aDetail({ id }) },
    );

    const similar = await readSimilarWanted(aDetail({ similarIds: ["gone", "here"] }));

    expect(similar.map((wanted) => wanted.id)).toEqual(["here"]);
  });

  test("drops an identifier whose read throws rather than failing the page", async () => {
    readPublicWanted.mockImplementation(async (id: string) => {
      if (id === "boom") throw new Error("boom");
      return { ok: true, data: aDetail({ id }) };
    });

    const similar = await readSimilarWanted(aDetail({ similarIds: ["boom", "here"] }));

    expect(similar.map((wanted) => wanted.id)).toEqual(["here"]);
  });

  test("reads no more than a handful, however many identifiers arrive", async () => {
    readPublicWanted.mockImplementation(async (id: string) => ({
      ok: true,
      data: aDetail({ id }),
    }));

    await readSimilarWanted(aDetail({ similarIds: ["a", "b", "c", "d", "e", "f"] }), 4);

    expect(readPublicWanted).toHaveBeenCalledTimes(4);
  });
});

describe("the reference instant", () => {
  test("is the real clock now that the data is real", () => {
    const before = Date.now();
    const now = Date.parse(marketplaceNow());

    expect(Number.isNaN(now)).toBe(false);
    expect(now).toBeGreaterThanOrEqual(before - 1000);
    expect(now).toBeLessThanOrEqual(Date.now() + 1000);
  });
});
