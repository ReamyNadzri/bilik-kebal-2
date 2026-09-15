import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { SupabaseReconciliationRepository } from "./supabase-reconciliation-repository";

describe("SupabaseReconciliationRepository", () => {
  it("maps the trusted unresolved-event projection without exposing payload data", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            id: "event-1",
            provider: "toyyibpay",
            provider_bill_id: "bill-1",
            provider_transaction_id: "transaction-1",
            received_at: "2026-09-15T12:00:00.000Z",
            reason: "unknown_bill",
          },
        ],
        error: null,
      }),
    } as unknown as SupabaseClient<Database>;

    await expect(
      new SupabaseReconciliationRepository(client).listUnresolvedProviderEvents(25),
    ).resolves.toEqual([
      {
        id: "event-1",
        provider: "toyyibpay",
        providerBillId: "bill-1",
        providerTransactionId: "transaction-1",
        receivedAt: "2026-09-15T12:00:00.000Z",
        reason: "unknown_bill",
      },
    ]);
  });
});
