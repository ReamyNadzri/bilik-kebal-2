import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRequestSupabaseClient, getRequestUser } from "@/lib/supabase/server";
import { SupabaseClaimReviewRepository } from "../repositories/supabase-claim-review-repository";
import { SupabaseApprovedClaimFilePromoter } from "../storage/supabase-approved-claim-file-promoter";
import { ClaimReviewService, type ApprovedClaimFilePromoter } from "./claim-review-service";

export async function createClaimReviewService(): Promise<ClaimReviewService | null> {
  const client = await getRequestSupabaseClient();
  const { data: auth } = await getRequestUser();
  if (!auth.user) return null;
  // Created on first use, so listing the queue never needs the service role.
  const promoter: ApprovedClaimFilePromoter = {
    promote: (claimId) =>
      new SupabaseApprovedClaimFilePromoter(createSupabaseAdminClient()).promote(claimId),
  };
  return new ClaimReviewService(new SupabaseClaimReviewRepository(client), promoter);
}
