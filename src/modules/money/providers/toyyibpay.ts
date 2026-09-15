import { createHash, timingSafeEqual } from "node:crypto";
import type {
  ProviderBill,
  ProviderCallback,
  ToyyibPayRawCallback,
  VerifiedProviderCallback,
} from "@/contracts/money";

export interface ToyyibPayGateway {
  createBill(input: {
    amountSen: number;
    reference: string;
  }): Promise<{ billCode: string; paymentUrl: string }>;
}

interface ToyyibPayConfig {
  merchantCode: string;
  secret: string;
  now?: () => Date;
}

function parseAmountSen(amount: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(amount);
  if (!match) return null;
  const value = BigInt(match[1]!) * 100n + BigInt((match[2] ?? "").padEnd(2, "0") || "0");
  return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : null;
}

export class ToyyibPayAdapter {
  private readonly now: () => Date;
  constructor(
    private readonly gateway: ToyyibPayGateway,
    private readonly config: ToyyibPayConfig,
  ) {
    this.now = config.now ?? (() => new Date());
  }

  async createBill(input: { amountSen: number; reference: string }): Promise<ProviderBill> {
    const bill = await this.gateway.createBill(input);
    return {
      expiresAt: new Date(this.now().getTime() + 30 * 60_000).toISOString(),
      paymentUrl: bill.paymentUrl,
      providerBillId: bill.billCode,
    };
  }

  verifyCallback(
    callback: ToyyibPayRawCallback,
  ): { ok: true; data: VerifiedProviderCallback } | { ok: false; reason: "amount" | "signature" } {
    const expected = createHash("md5")
      .update(`${this.config.secret}${callback.status}${callback.order_id}${callback.refno}ok`)
      .digest("hex");
    const received = Buffer.from(callback.hash, "hex");
    const expectedBytes = Buffer.from(expected, "hex");
    if (received.length !== expectedBytes.length || !timingSafeEqual(received, expectedBytes))
      return { ok: false, reason: "signature" };
    const amountSen = parseAmountSen(callback.amount);
    if (amountSen === null) return { ok: false, reason: "amount" };
    const normalized: ProviderCallback = {
      amountSen,
      merchantCode: this.config.merchantCode,
      providerBillId: callback.billcode,
      providerTransactionId: callback.refno,
      receivedAt: callback.transaction_time ?? new Date().toISOString(),
      signature: callback.hash,
      status:
        callback.status === "1" ? "successful" : callback.status === "2" ? "pending" : "failed",
    };
    return { ok: true, data: { ...normalized, verified: true } };
  }
}

export class HttpToyyibPayGateway implements ToyyibPayGateway {
  constructor(
    private readonly config: {
      baseUrl: string;
      userSecretKey: string;
      categoryCode: string;
      callbackUrl: string;
      returnUrl: string;
    },
  ) {}

  async createBill(input: { amountSen: number; reference: string }) {
    const body = new URLSearchParams({
      billAmount: String(input.amountSen),
      billCallbackUrl: this.config.callbackUrl,
      billDescription: `VAULTIX contribution ${input.reference}`,
      billExternalReferenceNo: input.reference,
      billName: "VAULTIX contribution",
      billPayorInfo: "0",
      billPriceSetting: "1",
      billReturnUrl: this.config.returnUrl,
      categoryCode: this.config.categoryCode,
      userSecretKey: this.config.userSecretKey,
    });
    const response = await fetch(
      `${this.config.baseUrl.replace(/\/$/, "")}/index.php/api/createBill`,
      { body, headers: { "Content-Type": "application/x-www-form-urlencoded" }, method: "POST" },
    );
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(payload) || typeof payload[0]?.BillCode !== "string")
      throw new Error("ToyyibPay bill creation failed");
    const billCode = payload[0].BillCode;
    return { billCode, paymentUrl: `${this.config.baseUrl.replace(/\/$/, "")}/${billCode}` };
  }
}
