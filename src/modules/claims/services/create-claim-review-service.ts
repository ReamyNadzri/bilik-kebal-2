import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SupabaseClaimReviewRepository } from "../repositories/supabase-claim-review-repository";
import { ClaimReviewService } from "./claim-review-service";

export async function createClaimReviewService(): Promise<ClaimReviewService | null> {
  const client = await createSupabaseServerClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return null;
  return new ClaimReviewService(new SupabaseClaimReviewRepository(client));
}
