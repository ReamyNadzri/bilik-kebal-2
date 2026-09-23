import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabaseModerationRepository } from "../repositories/supabase-moderation-repository";
import { ClaimModerationService } from "./claim-moderation-service";

export async function createClaimModerationService(): Promise<ClaimModerationService | null> {
  const client = await createSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return null;
  return new ClaimModerationService(new SupabaseModerationRepository(client));
}
