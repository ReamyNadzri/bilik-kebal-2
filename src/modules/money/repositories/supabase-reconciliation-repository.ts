import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type {
  ReconciliationRepository,
  UnresolvedProviderEvent,
} from "../services/reconciliation-service";

export class SupabaseReconciliationRepository implements ReconciliationRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async listUnresolvedProviderEvents(limit: number): Promise<UnresolvedProviderEvent[]> {
    const { data, error } = await this.client.rpc("list_unresolved_provider_events", {
      max_rows: limit,
    });
    if (error) throw error;
    return data.map((row) => ({
      id: row.id,
      provider: "toyyibpay",
      providerBillId: row.provider_bill_id,
      providerTransactionId: row.provider_transaction_id,
      receivedAt: row.received_at,
      reason: row.reason as UnresolvedProviderEvent["reason"],
    }));
  }
}
