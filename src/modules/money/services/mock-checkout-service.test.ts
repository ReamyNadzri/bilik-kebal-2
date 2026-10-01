import { describe, expect, it, vi } from "vitest";
import type { PayerBill } from "@/contracts/money";
import type { WantedActor } from "@/modules/wanted/domain/wanted-policy";
import { MockPaymentGateway } from "../providers/mock-gateway";
import { MockCheckoutService } from "./contribution-service";

const actor: WantedActor = {
  userId: "00000000-0000-4000-8000-000000000001",
  emailVerified: true,
  institutionId: "00000000-0000-4000-8000-000000000002",
  institutionVerified: true,
  restricted: false,
};
const billCode = "mock_0123456789abcdef01234567";
const now = () => new Date("2026-09-30T10:00:00.000Z");
const pending: PayerBill = {
  amountSen: 1000 as never,
  billCode,
  expiresAt: "2026-09-30T10:30:00.000Z",
  feeSen: 100 as never,
  paidAt: null,
  provider: "mock",
  purpose: "back",
  status: "pending",
  totalSen: 1100 as never,
  wantedId: "00000000-0000-4000-8000-000000000009",
  wantedOpen: true,
  wantedTitle: "Past year papers for MAT183",
};

function setup(bill: PayerBill | null = pending, paymentMode: "mock" | "sandbox" = "mock") {
  const payer = {
    readOwnBill: vi.fn().mockResolvedValue(bill),
    cancelOwnBill: vi.fn().mockResolvedValue(undefined),
  };
  const ledger = {
    handleCallback: vi
      .fn()
      .mockResolvedValue({ ok: true, data: { accepted: true, duplicate: false } }),
  };
  const gateway = new MockPaymentGateway({ secret: "s", now });
  const service = new MockCheckoutService(payer, ledger, gateway, { paymentMode, now });
  return { gateway, ledger, payer, service };
}

describe("MockCheckoutService", () => {
  it("pays through a signed provider event for the billed total", async () => {
    const { gateway, ledger, service } = setup();
    expect(await service.complete(actor, billCode, "paid")).toEqual({
      ok: true,
      data: { billCode, returnUrl: `/payment/return?bill=${billCode}` },
    });
    const event = ledger.handleCallback.mock.calls[0]![0];
    expect(gateway.verifyCallback(event)).toMatchObject({
      ok: true,
      data: { amountSen: 1100, providerBillId: billCode, status: "successful" },
    });
  });

  it("cancels without any provider event", async () => {
    const { ledger, payer, service } = setup();
    expect(await service.complete(actor, billCode, "cancelled")).toMatchObject({ ok: true });
    expect(payer.cancelOwnBill).toHaveBeenCalledWith(billCode);
    expect(ledger.handleCallback).not.toHaveBeenCalled();
  });

  it("does nothing twice: a settled bill only returns", async () => {
    const { ledger, payer, service } = setup({ ...pending, status: "paid", paidAt: "x" });
    expect(await service.complete(actor, billCode, "paid")).toMatchObject({ ok: true });
    expect(ledger.handleCallback).not.toHaveBeenCalled();
    expect(payer.cancelOwnBill).not.toHaveBeenCalled();
  });

  it("refuses an expired bill, a missing bill and a switched-off gateway", async () => {
    expect(
      await setup({ ...pending, expiresAt: "2026-09-30T09:59:00.000Z" }).service.complete(
        actor,
        billCode,
        "paid",
      ),
    ).toMatchObject({ ok: false, code: "PAYMENT_BILL_CLOSED" });
    expect(await setup(null).service.complete(actor, billCode, "paid")).toMatchObject({
      ok: false,
      code: "PAYMENT_BILL_NOT_FOUND",
    });
    expect(await setup(pending, "sandbox").service.complete(actor, billCode, "paid")).toMatchObject(
      { ok: false, code: "PAYMENT_DISABLED" },
    );
    expect(await setup().service.complete(null, billCode, "paid")).toMatchObject({
      ok: false,
      code: "AUTH_REQUIRED",
    });
    expect(await setup().service.complete(actor, "bill-1", "paid")).toMatchObject({
      ok: false,
      code: "PAYMENT_BILL_NOT_FOUND",
    });
  });
});
