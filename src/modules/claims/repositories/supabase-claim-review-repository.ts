import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { ClaimReviewQueueItem } from "@/contracts/claim-reviews";
import type { ClaimReviewRepository } from "../services/claim-review-service";

export class SupabaseClaimReviewRepository implements ClaimReviewRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async listQueue(): Promise<ClaimReviewQueueItem[]> {
    const { data, error } = await this.client
      .from("claims")
      .select(
        "id, wanted_request_id, institution_id, status, file_name, mime_type, size_bytes, created_at",
      )
      .in("status", ["screening", "needs_information", "under_review"])
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      claimId: row.id,
      wantedId: row.wanted_request_id,
      institutionId: row.institution_id,
      status: row.status as ClaimReviewQueueItem["status"],
      fileName: row.file_name,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      createdAt: row.created_at,
    }));
  }

  async recordReview(input: Parameters<ClaimReviewRepository["recordReview"]>[0]): Promise<string> {
    if (input.decision === "approve") {
      const args = {
        target_claim_id: input.claimId,
        target_reason_code: input.reasonCode,
        ...(input.notes ? { target_notes: input.notes } : {}),
      };
      const { data, error } = await this.client.rpc("approve_winning_claim_and_fulfill", args);
      if (error || !data)
        throw new Error(error?.message ?? "Claim approval and fulfillment failed");
      return data;
    }

    const args = {
      target_claim_id: input.claimId,
      target_decision: input.decision,
      target_reason_code: input.reasonCode,
      ...(input.notes ? { target_notes: input.notes } : {}),
    };
    const { data, error } = await this.client.rpc("record_claim_review", args);
    if (error || !data) throw new Error("Claim review failed");
    return data;
  }
}
