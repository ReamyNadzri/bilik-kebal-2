import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PayerBill } from "@/contracts/money";
import { MockCheckout } from "./mock-checkout";

const bill: PayerBill = {
  amountSen: 2000 as never,
  billCode: "mock_0123456789abcdef01234567",
  expiresAt: "2026-09-30T10:30:00.000Z",
  feeSen: 200 as never,
  paidAt: null,
  provider: "mock",
  purpose: "back",
  status: "pending",
  totalSen: 2200 as never,
  wantedId: "00000000-0000-4000-8000-000000000009",
  wantedOpen: true,
  wantedTitle: "Past year papers for MAT183",
};

describe("MockCheckout", () => {
  const originalFetch = global.fetch;
  const assign = vi.fn();
  beforeEach(() => {
    global.fetch = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
  });
  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllGlobals();
    assign.mockReset();
  });

  it("says it is a test gateway and itemises the fee on top", () => {
    render(<MockCheckout bill={bill} />);

    expect(screen.getByRole("note")).toHaveTextContent(/Test payment gateway.*No real money moves/);
    const breakdown = screen.getByLabelText("What you are paying");
    expect(within(breakdown).getByText("RM 20")).toBeInTheDocument();
    expect(within(breakdown).getByText("+RM 2")).toBeInTheDocument();
    expect(within(breakdown).getByText("RM 22")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay RM 22 (test)" })).toBeInTheDocument();
  });

  it("pays through the checkout route and goes to the return page", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          data: { billCode: bill.billCode, returnUrl: `/payment/return?bill=${bill.billCode}` },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    render(<MockCheckout bill={bill} />);
    fireEvent.click(screen.getByRole("button", { name: "Pay RM 22 (test)" }));

    await vi.waitFor(() =>
      expect(assign).toHaveBeenCalledWith(`/payment/return?bill=${bill.billCode}`),
    );
    const [path, init] = vi.mocked(global.fetch).mock.calls[0]!;
    expect(path).toBe(`/api/payments/mock/${bill.billCode}`);
    expect(JSON.parse(String(init?.body))).toEqual({ outcome: "paid" });
  });

  it("cancels, and shows a refusal without leaving the page", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: false,
          code: "PAYMENT_BILL_CLOSED",
          message: "This bill has expired.",
        }),
        { status: 409, headers: { "Content-Type": "application/json" } },
      ),
    );
    render(<MockCheckout bill={bill} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel payment" }));

    expect(await screen.findByText("This bill has expired.")).toBeInTheDocument();
    expect(JSON.parse(String(vi.mocked(global.fetch).mock.calls[0]![1]?.body))).toEqual({
      outcome: "cancelled",
    });
    expect(assign).not.toHaveBeenCalled();
  });
});
