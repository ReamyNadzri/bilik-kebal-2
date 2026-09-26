import { getRequestSupabaseClient, getRequestUser } from "@/lib/supabase/server";
import { SupabasePayoutRepository } from "../repositories/supabase-payout-repository";
import { PayoutService } from "./payout-service";

export async function createPayoutService(): Promise<{
  service: PayoutService;
  userId: string;
} | null> {
  const client = await getRequestSupabaseClient();
  const { data: auth } = await getRequestUser();
  if (!auth.user) return null;
  return {
    service: new PayoutService(new SupabasePayoutRepository(client)),
    userId: auth.user.id,
  };
}
