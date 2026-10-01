import { describe, expect, it } from "vitest";
import { isMockBillCode, MockPaymentGateway } from "./mock-gateway";

const now = () => new Date("2026-09-30T10:00:00.000Z");

describe("MockPaymentGateway", () => {
  it("opens a bill on VAULTIX's own checkout, valid for 30 minutes", async () => {
    const bill = await new MockPaymentGateway({ secret: "s", now }).createBill({
      amountSen: 1100,
      reference: "draft-1",
    });
    expect(isMockBillCode(bill.providerBillId)).toBe(true);
    expect(bill.paymentUrl).toBe(`/payment/checkout/${bill.providerBillId}`);
    expect(bill.expiresAt).toBe("2026-09-30T10:30:00.000Z");
  });

  it("verifies its own signed events with the billed total", () => {
    const gateway = new MockPaymentGateway({ secret: "s", now });
    const event = gateway.signEvent({ billCode: "mock_x", outcome: "paid", totalSen: 1105 });
    expect(event.amount).toBe("11.05");
    expect(gateway.verifyCallback(event)).toMatchObject({
      ok: true,
      data: { provider: "mock", providerBillId: "mock_x", amountSen: 1105, status: "successful" },
    });
    const failed = gateway.signEvent({ billCode: "mock_x", outcome: "failed", totalSen: 1105 });
    expect(gateway.verifyCallback(failed)).toMatchObject({ ok: true, data: { status: "failed" } });
  });

  it("refuses a forged or altered event", () => {
    const gateway = new MockPaymentGateway({ secret: "s", now });
    const event = gateway.signEvent({ billCode: "mock_x", outcome: "failed", totalSen: 1100 });
    expect(gateway.verifyCallback({ ...event, status: "1" })).toEqual({
      ok: false,
      reason: "signature",
    });
    expect(gateway.verifyCallback({ ...event, amount: "0.01" })).toEqual({
      ok: false,
      reason: "signature",
    });
    const other = new MockPaymentGateway({ secret: "other", now });
    expect(other.verifyCallback(event)).toEqual({ ok: false, reason: "signature" });
  });
});
