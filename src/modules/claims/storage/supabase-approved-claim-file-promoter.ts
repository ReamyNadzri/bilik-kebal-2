import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database";
import type { ApprovedClaimFilePromoter } from "../services/claim-review-service";
import { promoteApprovedClaimFile, type PromotionOutcome } from "./promote-approved-claim-file";

/**
 * Takes the service-role client: members cannot read quarantine or write to the
 * approved bucket. Only a claim the database already records as approved, in
 * the approved bucket, is copied.
 */
export class SupabaseApprovedClaimFilePromoter implements ApprovedClaimFilePromoter {
  constructor(private readonly admin: SupabaseClient<Database>) {}

  async promote(claimId: string): Promise<PromotionOutcome> {
    const { data, error } = await this.admin
      .from("claims")
      .select("object_key")
      .eq("id", claimId)
      .eq("status", "approved")
      .eq("bucket", "approved")
      .maybeSingle();
    if (error || !data) return "failed";
    return promoteApprovedClaimFile(this.admin.storage, data.object_key);
  }
}
