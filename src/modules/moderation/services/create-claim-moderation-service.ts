import { getRequestSupabaseClient, getRequestUser } from "@/lib/supabase/server";
import { SupabaseModerationRepository } from "../repositories/supabase-moderation-repository";
import { ClaimModerationService } from "./claim-moderation-service";

export async function createClaimModerationService(): Promise<ClaimModerationService | null> {
  const client = await getRequestSupabaseClient();
  const { data: auth } = await getRequestUser();
  if (!auth.user) return null;
  return new ClaimModerationService(new SupabaseModerationRepository(client));
}
