import type { WantedSummary } from "@/contracts/marketplace";
import type { BackedWantedRecord } from "../domain/own-backings";

const server = vi.hoisted(() => ({
  getRequestSupabaseClient: vi.fn(),
  getRequestUser: vi.fn(),
}));
const repository = vi.hoisted(() => ({
  listOwnBackedWanted: vi.fn(),
  listWantedByPublicIds: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => server);
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("@/modules/identity", () => ({
  loadAccountContext: vi.fn(),
  loadUniversityChoice: vi.fn(),
}));
vi.mock("../repositories/supabase-wanted-repository", () => ({
  SupabaseWantedRepository: class {
    listOwnBackedWanted = repository.listOwnBackedWanted;
    listWantedByPublicIds = repository.listWantedByPublicIds;
  },
}));

import { listOwnBackedWanted } from "./wanted-operations";

const record = (publicId: string, overrides: Partial<BackedWantedRecord> = {}) =>
  ({
    publicId,
    title: `Title ${publicId}`,
    status: "open",
    withdrawn: false,
    removed: false,
    backedAt: "2026-10-03T01:00:00Z",
    refundSen: 0,
    refundState: "none",
    ...overrides,
  }) as BackedWantedRecord;
const summary = (publicId: string) => ({ id: publicId, title: publicId }) as WantedSummary;

beforeEach(() => {
  server.getRequestSupabaseClient.mockReset().mockResolvedValue({});
  server.getRequestUser.mockReset().mockResolvedValue({ data: { user: { id: "me" } } });
  repository.listOwnBackedWanted.mockReset();
  repository.listWantedByPublicIds.mockReset();
});

test("live Wanteds become cards in backing order; closed ones keep their refund", async () => {
  repository.listOwnBackedWanted.mockResolvedValue([
    record("p-2"),
    record("p-gone", {
      status: "withdrawn",
      withdrawn: true,
      refundState: "pending",
      refundSen: 2200,
    }),
    record("p-3"),
    record("p-1"),
  ]);
  // Summaries come back in some other order, and one is no longer readable.
  repository.listWantedByPublicIds.mockResolvedValue([summary("p-1"), summary("p-2")]);

  const result = await listOwnBackedWanted();

  expect(result?.live.map((item) => item.id)).toEqual(["p-2", "p-1"]);
  expect(result?.closed).toEqual([
    expect.objectContaining({
      publicId: "p-gone",
      reason: "withdrawn",
      refundState: "pending",
      refundSen: 2200,
    }),
  ]);
  // A closed Wanted is never read as a card.
  expect(repository.listWantedByPublicIds).toHaveBeenCalledWith(["p-2", "p-3", "p-1"]);
});

test("skips the card read when every backing is closed", async () => {
  repository.listOwnBackedWanted.mockResolvedValue([
    record("p-x", { status: "expired", refundState: "refunded", refundSen: 1100 }),
  ]);

  const result = await listOwnBackedWanted();

  expect(result?.live).toEqual([]);
  expect(result?.closed).toHaveLength(1);
  expect(repository.listWantedByPublicIds).not.toHaveBeenCalled();
});

test("gives empty lists to a signed-out reader without reading anything", async () => {
  server.getRequestUser.mockResolvedValue({ data: { user: null } });

  await expect(listOwnBackedWanted()).resolves.toEqual({ live: [], closed: [] });
  expect(repository.listOwnBackedWanted).not.toHaveBeenCalled();
});

test("gives null when a read fails", async () => {
  repository.listOwnBackedWanted.mockResolvedValue([record("p-1")]);
  repository.listWantedByPublicIds.mockRejectedValue(new Error("down"));

  await expect(listOwnBackedWanted()).resolves.toBeNull();
});

test("gives null when the backing read throws", async () => {
  repository.listOwnBackedWanted.mockRejectedValue(new Error("down"));

  await expect(listOwnBackedWanted()).resolves.toBeNull();
});
