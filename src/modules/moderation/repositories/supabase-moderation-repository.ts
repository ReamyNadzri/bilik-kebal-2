import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { ClaimAppealDetails, ClaimReportDetails } from "@/contracts/moderation";
import type { ModerationRepository } from "../services/claim-moderation-service";

export class SupabaseModerationRepository implements ModerationRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async submitReport(input: {
    claimId: string;
    category: string;
    description: string;
  }): Promise<{ reportId: string }> {
    const { data, error } = await (this.client as any).rpc("submit_claim_report", {
      target_claim_id: input.claimId,
      target_category: input.category,
      target_description: input.description,
    });

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to submit claim report");
    }

    return { reportId: data as string };
  }

  async submitAppeal(input: {
    claimId: string;
    reason: string;
  }): Promise<{ appealId: string; deadline: string }> {
    const { data, error } = await (this.client as any).rpc("submit_claim_appeal", {
      target_claim_id: input.claimId,
      target_reason: input.reason,
    });

    if (error || !data) {
      throw new Error(error?.message ?? "Failed to submit claim appeal");
    }

    // Read the created appeal deadline
    const { data: appealData, error: appealError } = await (this.client as any)
      .from("claim_appeals")
      .select("appeal_deadline")
      .eq("id", data)
      .single();

    if (appealError || !appealData) {
      return { appealId: data as string, deadline: "" };
    }

    return {
      appealId: data as string,
      deadline: appealData.appeal_deadline,
    };
  }

  async decideAppeal(input: {
    appealId: string;
    decision: string;
    reasonCode: string;
    notes: string | null;
  }): Promise<{ appealId: string; newClaimStatus: string }> {
    const { error } = await (this.client as any).rpc("record_claim_appeal_decision", {
      target_appeal_id: input.appealId,
      target_decision: input.decision,
      target_reason_code: input.reasonCode,
      ...(input.notes ? { target_notes: input.notes } : {}),
    });

    if (error) {
      throw new Error(error.message);
    }

    const newClaimStatus = input.decision === "overturned" ? "under_review" : "rejected";
    return {
      appealId: input.appealId,
      newClaimStatus,
    };
  }

  async listReports(options?: { status?: string }): Promise<ClaimReportDetails[]> {
    let query = (this.client as any)
      .from("claim_reports")
      .select(
        "id, claim_id, reporter_user_id, category, description, is_high_risk, status, created_at",
      )
      .order("created_at", { ascending: false });

    if (options?.status) {
      query = query.eq("status", options.status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      id: row.id,
      claimId: row.claim_id,
      reporterUserId: row.reporter_user_id,
      category: row.category,
      description: row.description,
      isHighRisk: row.is_high_risk,
      status: row.status,
      createdAt: row.created_at,
    }));
  }

  async listAppeals(options?: { status?: string }): Promise<ClaimAppealDetails[]> {
    let query = (this.client as any)
      .from("claim_appeals")
      .select(
        "id, claim_id, original_review_id, appellant_user_id, reason, status, appeal_deadline, created_at, decided_at, reviewer_user_id, decision, decision_reason_code, decision_notes",
      )
      .order("created_at", { ascending: false });

    if (options?.status) {
      query = query.eq("status", options.status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      id: row.id,
      claimId: row.claim_id,
      originalReviewId: row.original_review_id,
      appellantUserId: row.appellant_user_id,
      reason: row.reason,
      status: row.status,
      appealDeadline: row.appeal_deadline,
      createdAt: row.created_at,
      decidedAt: row.decided_at,
      reviewerUserId: row.reviewer_user_id,
      decision: row.decision,
      decisionReasonCode: row.decision_reason_code,
      decisionNotes: row.decision_notes,
    }));
  }
}
