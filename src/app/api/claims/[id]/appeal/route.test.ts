import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mockSubmitAppeal = vi.fn();

vi.mock("@/modules/moderation/services/create-claim-moderation-service", () => ({
  createClaimModerationService: vi.fn().mockImplementation(async () => ({
    submitAppeal: mockSubmitAppeal,
  })),
}));

describe("POST /api/claims/[id]/appeal", () => {
  it("submits claim appeal successfully with 201 status", async () => {
    mockSubmitAppeal.mockResolvedValue({
      ok: true,
      data: { appealId: "appeal-123", deadline: "2026-09-30T10:00:00Z" },
    });

    const request = new Request("http://localhost/api/claims/claim-123/appeal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: "Page 4 contains the syllabus matching exactly what the commissioner asked.",
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: "74000000-0000-4000-8000-000000000001" }),
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.appealId).toBe("appeal-123");
  });

  it("returns 410 when appeal window has expired", async () => {
    mockSubmitAppeal.mockResolvedValue({
      ok: false,
      code: "APPEAL_EXPIRED",
      message: "The 7-day window to appeal this decision has lapsed.",
    });

    const request = new Request("http://localhost/api/claims/claim-123/appeal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: "Late appeal attempt after 7 calendar days.",
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: "74000000-0000-4000-8000-000000000001" }),
    });

    expect(response.status).toBe(410);
  });
});
