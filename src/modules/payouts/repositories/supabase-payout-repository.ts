import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type {
  PayoutTaskStatus,
  PayoutTaskView,
  RefundTaskStatus,
  RefundTaskView,
} from "@/contracts/payouts";
import type { PayoutRepository } from "./payout-repository";

interface PayoutTaskRow {
  id: string;
  wanted_request_id: string;
  claim_id: string;
  hunter_user_id: string;
  gross_bounty_sen: number;
  fee_rate_basis_points: number;
  platform_fee_sen: number;
  net_payout_sen: number;
  status: Database["public"]["Enums"]["payout_task_status"];
  external_reference: string | null;
  payout_method: string | null;
  evidence_notes: string | null;
  completed_at: string | null;
  owner_user_id: string | null;
  created_at: string;
  hunter_profile?: { display_name: string | null } | null;
}

interface RefundTaskRow {
  id: string;
  wanted_request_id: string;
  contribution_id: string;
  contributor_user_id: string;
  amount_sen: number;
  status: Database["public"]["Enums"]["refund_task_status"];
  external_reference: string | null;
  refund_method: string | null;
  evidence_notes: string | null;
  completed_at: string | null;
  owner_user_id: string | null;
  created_at: string;
  contributor_profile?: { display_name: string | null } | null;
}

export class SupabasePayoutRepository implements PayoutRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async listPayoutTasks(status?: string): Promise<PayoutTaskView[]> {
    let query = this.client
      .from("payout_tasks")
      .select(
        `
        id, wanted_request_id, claim_id, hunter_user_id,
        gross_bounty_sen, fee_rate_basis_points, platform_fee_sen, net_payout_sen,
        status, external_reference, payout_method, evidence_notes,
        completed_at, owner_user_id, created_at,
        hunter_profile:profiles!payout_tasks_hunter_user_id_fkey(display_name)
      `,
      )
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status as Database["public"]["Enums"]["payout_task_status"]);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as unknown as PayoutTaskRow[];

    return rows.map((row) => ({
      id: row.id,
      wantedRequestId: row.wanted_request_id,
      claimId: row.claim_id,
      hunterUserId: row.hunter_user_id,
      ...(row.hunter_profile?.display_name
        ? { hunterDisplayName: row.hunter_profile.display_name }
        : {}),
      grossBountySen: Number(row.gross_bounty_sen),
      feeRateBasisPoints: Number(row.fee_rate_basis_points),
      platformFeeSen: Number(row.platform_fee_sen),
      netPayoutSen: Number(row.net_payout_sen),
      status: row.status as PayoutTaskStatus,
      externalReference: row.external_reference,
      payoutMethod: row.payout_method,
      evidenceNotes: row.evidence_notes,
      completedAt: row.completed_at,
      ownerUserId: row.owner_user_id,
      createdAt: row.created_at,
    }));
  }

  async completePayout(
    payoutTaskId: string,
    externalRef: string,
    method: string,
    notes?: string,
  ): Promise<void> {
    const { error } = await this.client.rpc("record_owner_payout_completion", {
      target_payout_task_id: payoutTaskId,
      target_external_ref: externalRef,
      target_method: method,
      ...(notes ? { target_notes: notes } : {}),
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  async listRefundTasks(status?: string): Promise<RefundTaskView[]> {
    let query = this.client
      .from("refund_tasks")
      .select(
        `
        id, wanted_request_id, contribution_id, contributor_user_id,
        amount_sen, status, external_reference, refund_method, evidence_notes,
        completed_at, owner_user_id, created_at,
        contributor_profile:profiles!refund_tasks_contributor_user_id_fkey(display_name)
      `,
      )
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status as Database["public"]["Enums"]["refund_task_status"]);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as unknown as RefundTaskRow[];

    return rows.map((row) => ({
      id: row.id,
      wantedRequestId: row.wanted_request_id,
      contributionId: row.contribution_id,
      contributorUserId: row.contributor_user_id,
      ...(row.contributor_profile?.display_name
        ? { contributorDisplayName: row.contributor_profile.display_name }
        : {}),
      amountSen: Number(row.amount_sen),
      status: row.status as RefundTaskStatus,
      externalReference: row.external_reference,
      refundMethod: row.refund_method,
      evidenceNotes: row.evidence_notes,
      completedAt: row.completed_at,
      ownerUserId: row.owner_user_id,
      createdAt: row.created_at,
    }));
  }

  async completeRefund(
    refundTaskId: string,
    externalRef: string,
    method: string,
    notes?: string,
  ): Promise<void> {
    const { error } = await this.client.rpc("record_owner_refund_completion", {
      target_refund_task_id: refundTaskId,
      target_external_ref: externalRef,
      target_method: method,
      ...(notes ? { target_notes: notes } : {}),
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  async expireBounty(wantedRequestId: string): Promise<number> {
    const { data, error } = await this.client.rpc("expire_wanted_and_generate_refunds", {
      target_wanted_id: wantedRequestId,
    });

    if (error) {
      throw new Error(error.message);
    }

    return (data as number) ?? 0;
  }

  async isOwner(userId: string): Promise<boolean> {
    const { data } = await this.client
      .from("platform_role_assignments")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "owner")
      .maybeSingle();

    return !!data;
  }

  async isStaff(userId: string): Promise<boolean> {
    const { data } = await this.client
      .from("platform_role_assignments")
      .select("role")
      .eq("user_id", userId);

    return (data ?? []).some((r) => r.role === "owner" || r.role === "platform_sheriff");
  }
}
