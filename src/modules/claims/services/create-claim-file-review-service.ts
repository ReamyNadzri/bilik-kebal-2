import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRequestSupabaseClient, getRequestUser } from "@/lib/supabase/server";
import { SupabaseClaimFileReviewGateway } from "../gateways/supabase-claim-file-review-gateway";
import { ClaimFileReviewService } from "./claim-file-review-service";

export async function createClaimFileReviewService(): Promise<ClaimFileReviewService | null> {
  const client = await getRequestSupabaseClient();
  const { data: auth } = await getRequestUser();
  if (!auth.user) return null;
  return new ClaimFileReviewService(
    new SupabaseClaimFileReviewGateway(client, createSupabaseAdminClient),
  );
}
