import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mockExpireBounty = vi.fn();

vi.mock("@/modules/payouts/services/create-payout-service", () => ({
  createPayoutService: vi.fn().mockImplementation(async () => ({
    service: {
      expireBounty: mockExpireBounty,
    },
    userId: "staff-123",
  })),
}));

describe("POST /api/marketplace/wanted/[id]/expire", () => {
  it("expires bounty and returns refundsCreated count", async () => {
    mockExpireBounty.mockResolvedValue({
      ok: true,
      data: { refundsCreated: 3 },
    });

    const request = new Request("http://localhost/api/marketplace/wanted/wanted-123/expire", {
      method: "POST",
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: "wanted-123" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.refundsCreated).toBe(3);
  });

  it("returns 400 when bounty cannot be expired due to invalid state", async () => {
    mockExpireBounty.mockResolvedValue({
      ok: false,
      code: "INVALID_STATE",
      error: "Bounty is paused by an active appeal.",
    });

    const request = new Request("http://localhost/api/marketplace/wanted/wanted-123/expire", {
      method: "POST",
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: "wanted-123" }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("INVALID_STATE");
  });
});
