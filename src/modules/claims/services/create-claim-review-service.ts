import { getRequestSupabaseClient, getRequestUser } from "@/lib/supabase/server";
import { SupabaseClaimReviewRepository } from "../repositories/supabase-claim-review-repository";
import { ClaimReviewService } from "./claim-review-service";

export async function createClaimReviewService(): Promise<ClaimReviewService | null> {
  const client = await getRequestSupabaseClient();
  const { data: auth } = await getRequestUser();
  if (!auth.user) return null;
  return new ClaimReviewService(new SupabaseClaimReviewRepository(client));
}
