import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { SupabaseWantedRepository } from "./supabase-wanted-repository";

type Row = Record<string, unknown>;

/**
 * A chainable query over `rows` that applies its `eq` and `in` filters, so a
 * filter the repository forgets lets the wrong rows through and the test fails.
 */
function query(rows: Row[], error: unknown = null) {
  let current = rows;
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.eq = vi.fn((column: string, value: unknown) => {
    current = current.filter((row) => row[column] === value);
    return chain;
  });
  chain.in = vi.fn((column: string, values: unknown[]) => {
    current = current.filter((row) => values.includes(row[column]));
    return chain;
  });
  chain.then = (resolve: (value: unknown) => unknown) =>
    resolve({ data: error ? null : current, error });
  return chain;
}

const from = vi.fn();
const repository = () =>
  new SupabaseWantedRepository({ from } as unknown as SupabaseClient<Database>);

beforeEach(() => from.mockReset());

test("lists backed Wanteds most recent first, once each, without the member's own posts", async () => {
  const contributions = query([
    { contributor_user_id: "me", wanted_request_id: "w-own", created_at: "2026-10-03" },
    { contributor_user_id: "me", wanted_request_id: "w-a", created_at: "2026-10-02" },
    { contributor_user_id: "other", wanted_request_id: "w-other", created_at: "2026-10-02" },
    { contributor_user_id: "me", wanted_request_id: "w-a", created_at: "2026-10-01" },
    { contributor_user_id: "me", wanted_request_id: "w-b", created_at: "2026-09-01" },
  ]);
  const wanted = query([
    { id: "w-own", commissioner_user_id: "me" },
    { id: "w-a", commissioner_user_id: "poster" },
    { id: "w-b", commissioner_user_id: "poster" },
    { id: "w-other", commissioner_user_id: "me" },
  ]);
  from.mockImplementation((table: string) => (table === "contributions" ? contributions : wanted));

  await expect(repository().listBackedWantedIds("me")).resolves.toEqual(["w-a", "w-b"]);
  expect(contributions.eq).toHaveBeenCalledWith("contributor_user_id", "me");
  expect(wanted.eq).toHaveBeenCalledWith("commissioner_user_id", "me");
});

test("returns nothing without a second read when the member has backed nothing", async () => {
  from.mockImplementation(() => query([]));

  await expect(repository().listBackedWantedIds("me")).resolves.toEqual([]);
  expect(from).toHaveBeenCalledTimes(1);
});
