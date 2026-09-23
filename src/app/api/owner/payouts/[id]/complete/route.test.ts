import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mockCompletePayout = vi.fn();

vi.mock("@/modules/payouts/services/create-payout-service", () => ({
  createPayoutService: vi.fn().mockImplementation(async () => ({
    service: {
      completePayout: mockCompletePayout,
    },
    userId: "owner-123",
  })),
}));

describe("POST /api/owner/payouts/[id]/complete", () => {
  it("records payout completion successfully", async () => {
    mockCompletePayout.mockResolvedValue({
      ok: true,
      data: { payoutTaskId: "payout-123" },
    });

    const request = new Request("http://localhost/api/owner/payouts/payout-123/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        externalReference: "DUITNOW-00129",
        payoutMethod: "duitnow",
        evidenceNotes: "Sent to student via DuitNow ID",
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: "payout-123" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.payoutTaskId).toBe("payout-123");
  });

  it("returns 403 when caller is not owner", async () => {
    mockCompletePayout.mockResolvedValue({
      ok: false,
      code: "FORBIDDEN",
      error: "Only owner can record payouts",
    });

    const request = new Request("http://localhost/api/owner/payouts/payout-123/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        externalReference: "DUITNOW-00129",
        payoutMethod: "duitnow",
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: "payout-123" }),
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe("FORBIDDEN");
  });

  it("returns 400 when validation fails", async () => {
    const request = new Request("http://localhost/api/owner/payouts/payout-123/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        externalReference: "x",
        payoutMethod: "unknown_method",
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: "payout-123" }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("VALIDATION_ERROR");
  });
});
