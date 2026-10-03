import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database";
import { SupabaseWantedRepository } from "./supabase-wanted-repository";

const rpc = vi.fn();
const repository = () =>
  new SupabaseWantedRepository({ rpc } as unknown as SupabaseClient<Database>);

beforeEach(() => rpc.mockReset());

test("reads the member's backings through the RPC, money as integer sen", async () => {
  rpc.mockResolvedValue({
    data: [
      {
        public_id: "p-1",
        title: "Past year papers for MAT183",
        kind: "academic",
        status: "withdrawn",
        withdrawn: true,
        removed: false,
        backed_at: "2026-10-03T01:00:00Z",
        contributed_sen: 2000,
        // bigint arrives as a string from some clients
        refund_sen: "2200",
        refund_state: "pending",
      },
    ],
    error: null,
  });

  await expect(repository().listOwnBackedWanted()).resolves.toEqual([
    {
      publicId: "p-1",
      title: "Past year papers for MAT183",
      status: "withdrawn",
      withdrawn: true,
      removed: false,
      backedAt: "2026-10-03T01:00:00Z",
      refundSen: 2200,
      refundState: "pending",
    },
  ]);
  expect(rpc).toHaveBeenCalledWith("list_own_backed_wanted");
});

test("an unknown refund state is refused rather than shown", async () => {
  rpc.mockResolvedValue({
    data: [
      {
        public_id: "p-1",
        title: "t",
        kind: "academic",
        status: "open",
        withdrawn: false,
        removed: false,
        backed_at: "2026-10-03T01:00:00Z",
        contributed_sen: 1,
        refund_sen: 0,
        refund_state: "maybe",
      },
    ],
    error: null,
  });
  await expect(repository().listOwnBackedWanted()).rejects.toThrow();
});

test("a failed read throws", async () => {
  rpc.mockResolvedValue({ data: null, error: new Error("down") });
  await expect(repository().listOwnBackedWanted()).rejects.toThrow("down");
});
