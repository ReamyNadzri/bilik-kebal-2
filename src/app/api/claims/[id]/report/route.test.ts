import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mockSubmitReport = vi.fn();

vi.mock("@/modules/moderation/services/create-claim-moderation-service", () => ({
  createClaimModerationService: vi.fn().mockImplementation(async () => ({
    submitReport: mockSubmitReport,
  })),
}));

describe("POST /api/claims/[id]/report", () => {
  it("submits claim report successfully with 201 status", async () => {
    mockSubmitReport.mockResolvedValue({
      ok: true,
      data: { reportId: "report-123", isRestricted: true },
    });

    const request = new Request("http://localhost/api/claims/claim-123/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: "personal_data",
        description: "Student identity cards and phone numbers are exposed on page 2.",
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: "74000000-0000-4000-8000-000000000001" }),
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.isRestricted).toBe(true);
  });

  it("returns 400 when body is invalid", async () => {
    const request = new Request("http://localhost/api/claims/claim-123/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: "74000000-0000-4000-8000-000000000001" }),
    });

    expect(response.status).toBe(400);
  });
});
