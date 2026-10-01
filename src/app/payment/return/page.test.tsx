import { render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import type { PayerBill, ReadPayerBillResult } from "@/contracts/money";

const readOwnPaymentBill = vi.fn<(billCode: string) => Promise<ReadPayerBillResult>>();
vi.mock("@/modules/money/loaders/money-operations", () => ({
  readOwnPaymentBill: (billCode: string) => readOwnPaymentBill(billCode),
}));

const { default: PaymentReturnPage } = await import("./page");

const bill: PayerBill = {
  amountSen: 1000 as never,
  billCode: "abc123",
  expiresAt: "2026-09-30T10:30:00.000Z",
  feeSen: 100 as never,
  paidAt: null,
  provider: "toyyibpay",
  purpose: "back",
  status: "pending",
  totalSen: 1100 as never,
  wantedId: "00000000-0000-4000-8000-000000000009",
  wantedOpen: true,
  wantedTitle: "Past year papers for MAT183",
};

async function renderWith(params: Record<string, string>) {
  render(await PaymentReturnPage({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  readOwnPaymentBill.mockReset();
  readOwnPaymentBill.mockResolvedValue({ ok: true, data: bill });
});

test("never reports a payment as confirmed from the redirect alone", async () => {
  await renderWith({ status_id: "1", billcode: "abc123", order_id: "order-9" });

  expect(screen.getByText("Waiting for the payment provider to confirm")).toBeInTheDocument();
  expect(screen.queryByText(/payment (was )?successful|paid/i)).not.toBeInTheDocument();
  expect(screen.getByText(/does not confirm a payment/)).toBeInTheDocument();
});

test("does not echo the provider's bill code or order reference", async () => {
  await renderWith({ status_id: "1", billcode: "abc123", order_id: "order-9" });

  expect(document.body.textContent).not.toMatch(/abc123|order-9/);
});

test("reports a payment only once the database records it paid", async () => {
  readOwnPaymentBill.mockResolvedValue({
    ok: true,
    data: { ...bill, status: "paid", paidAt: "2026-09-30T10:05:00.000Z" },
  });
  await renderWith({ status_id: "3", billcode: "abc123" });

  expect(screen.getByText("Paid: the bounty rose")).toBeInTheDocument();
  expect(screen.getByText(/RM 10 went to the bounty/)).toBeInTheDocument();
  expect(screen.getByText(/you paid RM 11 including the RM 1 platform fee/)).toBeInTheDocument();
});

test("says nothing was charged for a cancelled test payment", async () => {
  readOwnPaymentBill.mockResolvedValue({
    ok: true,
    data: { ...bill, provider: "mock", purpose: "publish", status: "failed" },
  });
  await renderWith({ bill: "mock_0123456789abcdef01234567" });

  expect(screen.getByText("The payment did not go through")).toBeInTheDocument();
  expect(
    screen.getByText(/Nothing was charged and your request was not published/),
  ).toBeInTheDocument();
});

test("says the bounty is unchanged when the provider reports a failed checkout", async () => {
  readOwnPaymentBill.mockResolvedValue({
    ok: false,
    code: "PAYMENT_BILL_NOT_FOUND",
    message: "Not found",
  });
  await renderWith({ status_id: "3" });

  expect(screen.getByText("The payment did not go through")).toBeInTheDocument();
  expect(screen.getByText(/bounty has not changed/)).toBeInTheDocument();
});
