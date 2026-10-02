import type { WantedSummary } from "@/contracts/marketplace";

const server = vi.hoisted(() => ({
  getRequestSupabaseClient: vi.fn(),
  getRequestUser: vi.fn(),
}));
const repository = vi.hoisted(() => ({
  listBackedWantedIds: vi.fn(),
  listWantedByIds: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => server);
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("@/modules/identity", () => ({
  loadAccountContext: vi.fn(),
  loadUniversityChoice: vi.fn(),
}));
vi.mock("../repositories/supabase-wanted-repository", () => ({
  SupabaseWantedRepository: class {
    listBackedWantedIds = repository.listBackedWantedIds;
    listWantedByIds = repository.listWantedByIds;
  },
}));

import { listOwnBackedWanted } from "./wanted-operations";

/** The client's one direct read: internal id to public id. */
function client(rows: { id: string; public_id: string }[], error: unknown = null) {
  const inFilter = vi.fn(() => Promise.resolve({ data: error ? null : rows, error }));
  return { from: vi.fn(() => ({ select: vi.fn(() => ({ in: inFilter })) })), inFilter };
}

const summary = (publicId: string) => ({ id: publicId, title: publicId }) as WantedSummary;

beforeEach(() => {
  server.getRequestUser.mockReset().mockResolvedValue({ data: { user: { id: "me" } } });
  repository.listBackedWantedIds.mockReset();
  repository.listWantedByIds.mockReset();
});

test("keeps the backing order through the internal-to-public id mapping", async () => {
  const db = client([
    { id: "w-1", public_id: "p-1" },
    { id: "w-2", public_id: "p-2" },
    { id: "w-3", public_id: "p-3" },
  ]);
  server.getRequestSupabaseClient.mockResolvedValue(db);
  repository.listBackedWantedIds.mockResolvedValue(["w-2", "w-3", "w-1"]);
  // Summaries come back in some other order, and one is no longer readable.
  repository.listWantedByIds.mockResolvedValue([summary("p-1"), summary("p-2")]);

  const result = await listOwnBackedWanted();

  expect(result?.map((item) => item.id)).toEqual(["p-2", "p-1"]);
  expect(repository.listBackedWantedIds).toHaveBeenCalledWith("me");
  expect(db.inFilter).toHaveBeenCalledWith("id", ["w-2", "w-3", "w-1"]);
});

test("gives an empty list to a signed-out reader without reading anything", async () => {
  server.getRequestSupabaseClient.mockResolvedValue(client([]));
  server.getRequestUser.mockResolvedValue({ data: { user: null } });

  await expect(listOwnBackedWanted()).resolves.toEqual([]);
  expect(repository.listBackedWantedIds).not.toHaveBeenCalled();
});

test("gives null when a read fails", async () => {
  server.getRequestSupabaseClient.mockResolvedValue(client([], new Error("down")));
  repository.listBackedWantedIds.mockResolvedValue(["w-1"]);
  repository.listWantedByIds.mockResolvedValue([summary("p-1")]);

  await expect(listOwnBackedWanted()).resolves.toBeNull();
});

test("gives null when the backing read throws", async () => {
  server.getRequestSupabaseClient.mockResolvedValue(client([]));
  repository.listBackedWantedIds.mockRejectedValue(new Error("down"));

  await expect(listOwnBackedWanted()).resolves.toBeNull();
});
