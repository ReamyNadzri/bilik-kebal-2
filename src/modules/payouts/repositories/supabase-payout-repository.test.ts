import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database";
import { SupabasePayoutRepository } from "./supabase-payout-repository";

function roles(rows: { role: string }[]) {
  const eq = vi.fn(() => Promise.resolve({ data: rows, error: null }));
  const from = vi.fn(() => ({ select: vi.fn(() => ({ eq })) }));
  return new SupabasePayoutRepository({ from } as unknown as SupabaseClient<Database>);
}

test("a Platform Sheriff is staff, so the refund queue is readable to them", async () => {
  await expect(roles([{ role: "platform_sheriff" }]).isStaff("s-1")).resolves.toBe(true);
  await expect(roles([{ role: "owner" }]).isStaff("o-1")).resolves.toBe(true);
  await expect(roles([]).isStaff("m-1")).resolves.toBe(false);
});
