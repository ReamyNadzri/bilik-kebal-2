import type { HandleProviderCallbackResult } from "@/contracts/money";

const { handleToyyibPayCallback } = vi.hoisted(() => ({
  handleToyyibPayCallback: vi.fn<(input: unknown) => Promise<HandleProviderCallbackResult>>(),
}));
vi.mock("@/modules/money/loaders/money-operations", () => ({ handleToyyibPayCallback }));
import { POST } from "./route";

function callbackRequest() {
  return new Request("http://local.test", {
    method: "POST",
    body: new URLSearchParams({
      amount: "12.50",
      billcode: "bill-1",
      hash: "0123456789abcdef0123456789abcdef",
      order_id: "intent-1",
      refno: "transaction-1",
      status: "1",
    }),
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });
}

describe("POST /api/payments/toyyibpay/callback", () => {
  it("acknowledges a safely handled callback", async () => {
    handleToyyibPayCallback.mockResolvedValueOnce({
      ok: true,
      data: { accepted: true, duplicate: false },
    });
    const response = await POST(callbackRequest());
    expect(response.status).toBe(200);
    expect(handleToyyibPayCallback).toHaveBeenCalledWith({
      amount: "12.50",
      billcode: "bill-1",
      hash: "0123456789abcdef0123456789abcdef",
      order_id: "intent-1",
      refno: "transaction-1",
      status: "1",
    });
  });

  it("returns a retryable response when the money boundary is unavailable", async () => {
    handleToyyibPayCallback.mockResolvedValueOnce({
      ok: false,
      code: "MONEY_UNAVAILABLE",
      message: "Try again",
    });
    expect((await POST(callbackRequest())).status).toBe(503);
  });
});
