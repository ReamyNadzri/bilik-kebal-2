export interface UnresolvedProviderEvent {
  id: string;
  provider: "toyyibpay";
  providerBillId: string;
  providerTransactionId: string;
  receivedAt: string;
  reason: "unknown_bill" | "amount_mismatch" | "invalid_state";
}

export interface ReconciliationRepository {
  listUnresolvedProviderEvents(limit: number): Promise<UnresolvedProviderEvent[]>;
}

export class ReconciliationService {
  constructor(private readonly repository: ReconciliationRepository) {}

  async list(limit = 100): Promise<UnresolvedProviderEvent[]> {
    const boundedLimit = Math.max(1, Math.min(500, Math.floor(limit)));
    return this.repository.listUnresolvedProviderEvents(boundedLimit);
  }
}
