import type { ProviderBill, VerifiedProviderCallback } from "@/contracts/money";
import type { StoredWantedDraft } from "@/modules/wanted/repositories/wanted-repository";

export interface MoneyRepository {
  findDraftForContribution(draftId: string, userId: string): Promise<StoredWantedDraft | null>;
  createContributionIntent(input: {
    draftId: string;
    userId: string;
    amountSen: number;
    duplicateCheckTokenHash: string;
    providerBill: ProviderBill;
  }): Promise<{ intentId: string }>;
  recordVerifiedContribution(
    callback: VerifiedProviderCallback,
  ): Promise<"accepted" | "duplicate" | "unknown" | "rejected">;
}
