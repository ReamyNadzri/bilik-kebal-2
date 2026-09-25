import { failure } from "@/contracts/operation-result";
import type { RedeemRewardCodeResult } from "@/contracts/rewards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabaseRewardCodeRepository } from "../repositories/supabase-reward-code-repository";
import { RewardCodeService } from "../services/reward-code-service";

export async function redeemRewardCode(input: unknown): Promise<RedeemRewardCodeResult> {
  try {
    const client = await createSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    const actor = user
      ? { emailVerified: Boolean(user.email_confirmed_at), userId: user.id }
      : null;
    return new RewardCodeService(new SupabaseRewardCodeRepository(client)).redeem(actor, input);
  } catch {
    return failure("REWARDS_UNAVAILABLE", "Codes cannot be redeemed right now. Try again.");
  }
}
