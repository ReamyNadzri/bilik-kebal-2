import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PayerBill,
  PaymentProviderName,
  ProviderBill,
  VerifiedProviderCallback,
} from "@/contracts/money";
import type { Sen } from "@/contracts/marketplace";
import type { Database } from "@/lib/supabase/database.types";
import type { StoredWantedDraft } from "@/modules/wanted/repositories/wanted-repository";
import type { WantedRepository } from "@/modules/wanted/repositories/wanted-repository";
import type { MoneyRepository } from "./money-repository";

interface PayerBillRow {
  provider: PaymentProviderName;
  provider_bill_id: string;
  status: PayerBill["status"];
  amount_sen: number;
  fee_sen: number;
  expires_at: string;
  paid_at: string | null;
  purpose: PayerBill["purpose"];
  wanted_public_id: string;
  wanted_title: string;
  wanted_status: string;
}

/**
 * The money RPCs from migration 202610180001 are called untyped until the
 * database types are regenerated.
 */
export class SupabaseMoneyRepository implements MoneyRepository {
  constructor(
    private readonly client: SupabaseClient<Database>,
    private readonly wantedRepository: WantedRepository,
  ) {}

  private get rpcClient(): SupabaseClient {
    return this.client as unknown as SupabaseClient;
  }

  findDraftForContribution(draftId: string, userId: string): Promise<StoredWantedDraft | null> {
    return this.wantedRepository.findDraft(draftId, userId);
  }

  async hasOwnPaymentDetails(): Promise<boolean> {
    const { data, error } = await this.rpcClient.rpc("my_payment_details");
    if (error) throw error;
    return Array.isArray(data) && data.length > 0;
  }

  async readBackingFeeRate(wantedPublicId: string): Promise<number | null> {
    const { data, error } = await this.rpcClient.rpc("backing_fee_rate", {
      target_public_id: wantedPublicId,
    });
    if (error) throw error;
    return typeof data === "number" ? data : null;
  }

  async createContributionIntent(input: {
    draftId: string;
    userId: string;
    amountSen: number;
    feeSen: number;
    duplicateCheckTokenHash: string;
    provider: PaymentProviderName;
    providerBill: ProviderBill;
  }): Promise<{ intentId: string }> {
    const { data, error } = await this.rpcClient.rpc("create_contribution_intent", {
      amount_sen: input.amountSen,
      draft_id: input.draftId,
      fee_sen: input.feeSen,
      intent_expires_at: input.providerBill.expiresAt,
      provider: input.provider,
      provider_bill_id: input.providerBill.providerBillId,
      token_hash_hex: input.duplicateCheckTokenHash,
    });
    if (error) throw error;
    return { intentId: data as string };
  }

  async createBackingIntent(input: {
    wantedPublicId: string;
    amountSen: number;
    feeSen: number;
    provider: PaymentProviderName;
    providerBill: ProviderBill;
  }): Promise<{ intentId: string }> {
    const { data, error } = await this.rpcClient.rpc("create_backing_intent", {
      amount_sen: input.amountSen,
      fee_sen: input.feeSen,
      intent_expires_at: input.providerBill.expiresAt,
      provider: input.provider,
      provider_bill_id: input.providerBill.providerBillId,
      target_public_id: input.wantedPublicId,
    });
    if (error) throw error;
    return { intentId: data as string };
  }

  async readOwnBill(billCode: string): Promise<PayerBill | null> {
    const { data, error } = await this.rpcClient.rpc("my_payment_bill", {
      target_provider_bill_id: billCode,
    });
    if (error) throw error;
    const row = (data as PayerBillRow[] | null)?.[0];
    if (!row) return null;
    return {
      amountSen: row.amount_sen as Sen,
      billCode: row.provider_bill_id,
      expiresAt: row.expires_at,
      feeSen: row.fee_sen as Sen,
      paidAt: row.paid_at,
      provider: row.provider,
      purpose: row.purpose,
      status: row.status,
      totalSen: (row.amount_sen + row.fee_sen) as Sen,
      wantedId: row.wanted_public_id,
      wantedOpen: row.wanted_status === "open",
      wantedTitle: row.wanted_title,
    };
  }

  async cancelOwnBill(billCode: string): Promise<void> {
    const { error } = await this.rpcClient.rpc("cancel_own_payment", {
      target_provider_bill_id: billCode,
    });
    if (error) throw error;
  }

  async recordVerifiedContribution(
    callback: VerifiedProviderCallback,
  ): Promise<"accepted" | "duplicate" | "unknown" | "rejected"> {
    const { data, error } = await this.client.rpc("record_verified_contribution", {
      amount_sen: callback.amountSen,
      payload_hash_hex: createHash("sha256").update(JSON.stringify(callback)).digest("hex"),
      provider_bill_id: callback.providerBillId,
      provider_name: callback.provider,
      provider_status: callback.status,
      provider_transaction_id: callback.providerTransactionId,
    });
    if (error) throw error;
    return (data as "accepted" | "duplicate" | "unknown" | "rejected") ?? "unknown";
  }
}
