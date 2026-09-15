import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { ToyyibPayRawCallback } from "@/contracts/money";
import { ToyyibPayAdapter } from "./toyyibpay";

const callback: ToyyibPayRawCallback = {
  amount: "12.50",
  billcode: "bill-1",
  hash: createHash("md5").update("secret1order11ok").digest("hex"),
  order_id: "order1",
  refno: "1",
  status: "1",
};

describe("ToyyibPayAdapter", () => {
  it("normalises a provider bill without exposing the secret", async () => {
    const gateway = {
      createBill: vi
        .fn()
        .mockResolvedValue({ billCode: "bill-1", paymentUrl: "https://toyyibpay.com/bill-1" }),
    };
    const adapter = new ToyyibPayAdapter(gateway, { merchantCode: "merchant", secret: "secret" });
    await expect(
      adapter.createBill({ amountSen: 1250, reference: "draft-1" }),
    ).resolves.toMatchObject({
      paymentUrl: "https://toyyibpay.com/bill-1",
      providerBillId: "bill-1",
    });
    expect(gateway.createBill).toHaveBeenCalledWith({ amountSen: 1250, reference: "draft-1" });
  });

  it("rejects a callback with the wrong signature", () => {
    const adapter = new ToyyibPayAdapter(
      { createBill: vi.fn() },
      { merchantCode: "merchant", secret: "secret" },
    );
    expect(adapter.verifyCallback({ ...callback, hash: "bad" })).toEqual({
      ok: false,
      reason: "signature",
    });
  });

  it("verifies ToyyibPay's MD5 callback and normalises status", () => {
    const adapter = new ToyyibPayAdapter(
      { createBill: vi.fn() },
      { merchantCode: "merchant", secret: "secret" },
    );
    expect(adapter.verifyCallback(callback)).toMatchObject({
      ok: true,
      data: { amountSen: 1250, status: "successful", providerBillId: "bill-1" },
    });
  });

  it("rejects a signed callback whose amount cannot be represented safely in sen", () => {
    const unsafeAmount = "999999999999999999999999999999999999999999999999999.99";
    const signed = {
      ...callback,
      amount: unsafeAmount,
      hash: createHash("md5").update("secret1order11ok").digest("hex"),
    };
    const adapter = new ToyyibPayAdapter(
      { createBill: vi.fn() },
      { merchantCode: "merchant", secret: "secret" },
    );
    expect(adapter.verifyCallback(signed)).toEqual({ ok: false, reason: "amount" });
  });
});
