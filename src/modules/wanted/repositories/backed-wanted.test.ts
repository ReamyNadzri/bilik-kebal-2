import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { SupabaseWantedRepository } from "./supabase-wanted-repository";

/** A chainable query that resolves to `result` wherever the chain ends. */
function query(result: unknown) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "order"]) chain[method] = vi.fn(() => chain);
  chain.then = (resolve: (value: unknown) => unknown) => resolve(result);
  return chain;
}

const from = vi.fn();
const repository = () =>
  new SupabaseWantedRepository({ from } as unknown as SupabaseClient<Database>);

beforeEach(() => from.mockReset());

test("lists backed Wanteds most recent first, once each, without the member's own posts", async () => {
  from.mockImplementation((table: string) =>
    table === "contributions"
      ? query({
          data: [
            { wanted_request_id: "w-own", created_at: "2026-10-03" },
            { wanted_request_id: "w-a", created_at: "2026-10-02" },
            { wanted_request_id: "w-a", created_at: "2026-10-01" },
            { wanted_request_id: "w-b", created_at: "2026-09-01" },
          ],
          error: null,
        })
      : query({ data: [{ id: "w-own" }], error: null }),
  );

  await expect(repository().listBackedWantedIds("me")).resolves.toEqual(["w-a", "w-b"]);
});

test("returns nothing without a second read when the member has backed nothing", async () => {
  from.mockImplementation(() => query({ data: [], error: null }));

  await expect(repository().listBackedWantedIds("me")).resolves.toEqual([]);
  expect(from).toHaveBeenCalledTimes(1);
});
