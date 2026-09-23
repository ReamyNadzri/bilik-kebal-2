import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mockCompleteRefund = vi.fn();

vi.mock("@/modules/payouts/services/create-payout-service", () => ({
  createPayoutService: vi.fn().mockImplementation(async () => ({
    service: {
      completeRefund: mockCompleteRefund,
    },
    userId: "owner-123",
  })),
}));

describe("POST /api/owner/refunds/[id]/complete", () => {
  it("records refund completion successfully", async () => {
    mockCompleteRefund.mockResolvedValue({
      ok: true,
      data: { refundTaskId: "refund-123" },
    });

    const request = new Request("http://localhost/api/owner/refunds/refund-123/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        externalReference: "REV-998877",
        refundMethod: "toyyibpay_reversal",
        evidenceNotes: "Full refund processed via payment portal",
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: "refund-123" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.refundTaskId).toBe("refund-123");
  });

  it("returns 403 when caller is not owner", async () => {
    mockCompleteRefund.mockResolvedValue({
      ok: false,
      code: "FORBIDDEN",
      error: "Only owner can record refunds",
    });

    const request = new Request("http://localhost/api/owner/refunds/refund-123/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        externalReference: "REV-998877",
        refundMethod: "toyyibpay_reversal",
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: "refund-123" }),
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe("FORBIDDEN");
  });
});
