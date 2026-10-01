import type {
  PaymentProviderName,
  ProviderBill,
  ToyyibPayRawCallback,
  VerifiedProviderCallback,
} from "@/contracts/money";

/**
 * A payment gateway as the contribution path sees it. `amountSen` is what the
 * payer is billed: the contribution plus the platform fee.
 *
 * ToyyibPay (`toyyibpay.ts`) and the test gateway (`mock-gateway.ts`) both
 * implement it, so connecting the real gateway changes the provider chosen in
 * `money-operations.ts` and nothing in the service, the database or the UI.
 */
export interface PaymentProvider {
  readonly name: PaymentProviderName;
  createBill(input: { amountSen: number; reference: string }): Promise<ProviderBill>;
  verifyCallback(
    callback: ToyyibPayRawCallback,
  ): { ok: true; data: VerifiedProviderCallback } | { ok: false; reason: "amount" | "signature" };
}
