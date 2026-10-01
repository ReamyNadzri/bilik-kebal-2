import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type {
  ProviderBill,
  ToyyibPayRawCallback,
  VerifiedProviderCallback,
} from "@/contracts/money";
import type { PaymentProvider } from "./payment-provider";

const BILL_CODE = /^mock_[0-9a-f]{24}$/;

export function isMockBillCode(value: string): boolean {
  return BILL_CODE.test(value);
}

function ringgit(sen: number): string {
  return `${Math.trunc(sen / 100)}.${String(sen % 100).padStart(2, "0")}`;
}

function parseAmountSen(amount: string): number | null {
  const match = /^(\d{1,6})\.(\d{2})$/.exec(amount);
  return match ? Number(match[1]) * 100 + Number(match[2]) : null;
}

/**
 * The test gateway: VAULTIX plays the payment provider.
 *
 * Bills and provider events are real rows, created and verified exactly as a
 * ToyyibPay bill and callback are, so the ledger, the bounty and the refund
 * and payout queues behave as they will in production. Only the checkout is
 * ours (`/payment/checkout/[billCode]`) and no money moves. Its events are
 * HMAC-signed with a server secret, in the ToyyibPay callback shape, so a
 * forged "paid" event is refused like a forged provider callback.
 */
export class MockPaymentGateway implements PaymentProvider {
  readonly name = "mock" as const;
  private readonly now: () => Date;

  constructor(private readonly config: { secret: string; now?: () => Date }) {
    this.now = config.now ?? (() => new Date());
  }

  async createBill(input: { amountSen: number; reference: string }): Promise<ProviderBill> {
    void input;
    const billCode = `mock_${randomBytes(12).toString("hex")}`;
    return {
      expiresAt: new Date(this.now().getTime() + 30 * 60_000).toISOString(),
      paymentUrl: `/payment/checkout/${billCode}`,
      providerBillId: billCode,
    };
  }

  /** The provider's event for a checkout outcome, signed as a provider would sign it. */
  signEvent(input: {
    billCode: string;
    totalSen: number;
    outcome: "paid" | "failed";
  }): ToyyibPayRawCallback {
    const event = {
      amount: ringgit(input.totalSen),
      billcode: input.billCode,
      order_id: input.billCode,
      refno: `mockref_${randomBytes(8).toString("hex")}`,
      status: input.outcome === "paid" ? ("1" as const) : ("3" as const),
      transaction_time: this.now().toISOString(),
    };
    return { ...event, hash: this.signature(event) };
  }

  verifyCallback(
    callback: ToyyibPayRawCallback,
  ): { ok: true; data: VerifiedProviderCallback } | { ok: false; reason: "amount" | "signature" } {
    const expected = Buffer.from(this.signature(callback), "hex");
    const received = Buffer.from(/^[0-9a-f]+$/i.test(callback.hash) ? callback.hash : "", "hex");
    if (received.length !== expected.length || !timingSafeEqual(received, expected))
      return { ok: false, reason: "signature" };
    const amountSen = parseAmountSen(callback.amount);
    if (amountSen === null) return { ok: false, reason: "amount" };
    return {
      ok: true,
      data: {
        amountSen,
        merchantCode: "vaultix-test-gateway",
        provider: "mock",
        providerBillId: callback.billcode,
        providerTransactionId: callback.refno,
        receivedAt: callback.transaction_time ?? this.now().toISOString(),
        signature: callback.hash,
        status:
          callback.status === "1" ? "successful" : callback.status === "2" ? "pending" : "failed",
        verified: true,
      },
    };
  }

  private signature(event: Omit<ToyyibPayRawCallback, "hash">): string {
    return createHmac("sha256", this.config.secret)
      .update([event.status, event.billcode, event.order_id, event.refno, event.amount].join("|"))
      .digest("hex");
  }
}
