import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  OwnPrivacyRequest,
  PrivacyRequestItem,
  PrivacyRequestKind,
  PrivacyRequestStatus,
} from "@/contracts/legal";
import type { Database } from "@/lib/supabase/database";
import type { LegalRepository } from "../services/legal-service";

/**
 * Everything runs on the caller's own session: the database functions decide
 * who may accept, submit, read or answer, and RLS limits a member to their own
 * rows. No admin client, no RLS bypass.
 */
export class SupabaseLegalRepository implements LegalRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async acceptTerms(version: string): Promise<"accepted" | "already_accepted"> {
    const { data, error } = await this.client.rpc("accept_terms", {
      confirmed_adult: true,
      target_version: version,
    });
    if (error) throw error;
    return data === "already_accepted" ? "already_accepted" : "accepted";
  }

  async submitPrivacyRequest(kind: PrivacyRequestKind, details: string): Promise<string> {
    const { data, error } = await this.client.rpc("submit_privacy_request", {
      target_details: details,
      target_kind: kind,
    });
    if (error) throw error;
    return data;
  }

  async listOwnPrivacyRequests(userId: string): Promise<OwnPrivacyRequest[]> {
    const { data, error } = await this.client
      .from("privacy_requests")
      .select("id, kind, details, status, answer, created_at, answered_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      kind: row.kind as PrivacyRequestKind,
      details: row.details,
      status: row.status as PrivacyRequestStatus,
      answer: row.answer,
      createdAt: row.created_at,
      answeredAt: row.answered_at,
    }));
  }

  async listPrivacyRequests(status: PrivacyRequestStatus): Promise<PrivacyRequestItem[]> {
    const { data, error } = await this.client.rpc("list_privacy_requests", {
      target_status: status,
    });
    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      kind: row.kind as PrivacyRequestKind,
      details: row.details,
      status: row.status as PrivacyRequestStatus,
      answer: row.answer,
      createdAt: row.created_at,
      answeredAt: row.answered_at,
      memberPublicId: row.member_public_id,
      memberDisplayName: row.member_display_name,
    }));
  }

  async answerPrivacyRequest(requestId: string, answer: string): Promise<void> {
    const { error } = await this.client.rpc("answer_privacy_request", {
      target_answer: answer,
      target_request_id: requestId,
    });
    if (error) throw error;
  }
}
