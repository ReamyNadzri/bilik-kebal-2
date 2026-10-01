import type { PayerBill, ProviderBill, VerifiedProviderCallback } from "@/contracts/money";
import type { PaymentProviderName } from "@/contracts/money";
import type { StoredWantedDraft } from "@/modules/wanted/repositories/wanted-repository";

export interface MoneyRepository {
  findDraftForContribution(draftId: string, userId: string): Promise<StoredWantedDraft | null>;
  /** Whether the signed-in member has a phone and bank account on file. */
  hasOwnPaymentDetails(): Promise<boolean>;
  /** The fee rate a Backer is charged, or null when the Wanted is not open for backing. */
  readBackingFeeRate(wantedPublicId: string): Promise<number | null>;
  createContributionIntent(input: {
    draftId: string;
    userId: string;
    amountSen: number;
    feeSen: number;
    duplicateCheckTokenHash: string;
    provider: PaymentProviderName;
    providerBill: ProviderBill;
  }): Promise<{ intentId: string }>;
  createBackingIntent(input: {
    wantedPublicId: string;
    amountSen: number;
    feeSen: number;
    provider: PaymentProviderName;
    providerBill: ProviderBill;
  }): Promise<{ intentId: string }>;
  /** The signed-in payer's own bill, or null. */
  readOwnBill(billCode: string): Promise<PayerBill | null>;
  /** Marks the signed-in payer's own pending bill failed; a no-op once settled. */
  cancelOwnBill(billCode: string): Promise<void>;
  recordVerifiedContribution(
    callback: VerifiedProviderCallback,
  ): Promise<"accepted" | "duplicate" | "unknown" | "rejected">;
}
