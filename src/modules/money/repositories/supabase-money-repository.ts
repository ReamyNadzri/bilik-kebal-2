import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProviderBill, VerifiedProviderCallback } from "@/contracts/money";
import type { Database } from "@/lib/supabase/database.types";
import type { StoredWantedDraft } from "@/modules/wanted/repositories/wanted-repository";
import type { WantedRepository } from "@/modules/wanted/repositories/wanted-repository";
import type { MoneyRepository } from "./money-repository";

export class SupabaseMoneyRepository implements MoneyRepository {
  constructor(
    private readonly client: SupabaseClient<Database>,
    private readonly wantedRepository: WantedRepository,
  ) {}

  findDraftForContribution(draftId: string, userId: string): Promise<StoredWantedDraft | null> {
    return this.wantedRepository.findDraft(draftId, userId);
  }

  async createContributionIntent(input: {
    draftId: string;
    userId: string;
    amountSen: number;
    duplicateCheckTokenHash: string;
    providerBill: ProviderBill;
  }): Promise<{ intentId: string }> {
    const { data, error } = await this.client.rpc("create_contribution_intent", {
      amount_sen: input.amountSen,
      draft_id: input.draftId,
      intent_expires_at: input.providerBill.expiresAt,
      provider: "toyyibpay",
      provider_bill_id: input.providerBill.providerBillId,
      token_hash_hex: input.duplicateCheckTokenHash,
    });
    if (error) throw error;
    return { intentId: data as string };
  }

  async recordVerifiedContribution(
    callback: VerifiedProviderCallback,
  ): Promise<"accepted" | "duplicate" | "unknown" | "rejected"> {
    const { data, error } = await this.client.rpc("record_verified_contribution", {
      amount_sen: callback.amountSen,
      payload_hash_hex: createHash("sha256").update(JSON.stringify(callback)).digest("hex"),
      provider_bill_id: callback.providerBillId,
      provider_name: "toyyibpay",
      provider_status: callback.status,
      provider_transaction_id: callback.providerTransactionId,
    });
    if (error) throw error;
    return (data as "accepted" | "duplicate" | "unknown" | "rejected") ?? "unknown";
  }
}
import { createHash } from "node:crypto";
