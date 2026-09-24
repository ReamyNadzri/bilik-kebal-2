import type { SupabaseClient } from "@supabase/supabase-js";
import type { RewardCodeOutcome } from "@/contracts/rewards";
import type { Database } from "@/lib/supabase/database.types";
import type { RewardCodeRepository } from "../services/reward-code-service";

/** Writes with the member's own session, so `auth.uid()` is the redeemer. */
export class SupabaseRewardCodeRepository implements RewardCodeRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async redeem(code: string): Promise<RewardCodeOutcome> {
    const { data, error } = await this.client.rpc("redeem_reward_code", { target_code: code });
    if (error) throw error;
    return data as RewardCodeOutcome;
  }

  async remainingFreeRequests(): Promise<number> {
    const { data, error } = await this.client.rpc("my_free_request_allowance");
    if (error) throw error;
    return data?.[0]?.remaining ?? 0;
  }
}
