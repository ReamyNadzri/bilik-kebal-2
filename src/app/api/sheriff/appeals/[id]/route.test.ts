import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mockDecideAppeal = vi.fn();

vi.mock("@/modules/moderation/services/create-claim-moderation-service", () => ({
  createClaimModerationService: vi.fn().mockImplementation(async () => ({
    decideAppeal: mockDecideAppeal,
  })),
}));

describe("POST /api/sheriff/appeals/[id]", () => {
  it("records appeal decision successfully", async () => {
    mockDecideAppeal.mockResolvedValue({
      ok: true,
      data: { appealId: "appeal-123", newClaimStatus: "under_review" },
    });

    const request = new Request("http://localhost/api/sheriff/appeals/appeal-123", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision: "overturned",
        reasonCode: "decision_overturned_evidence_valid",
        notes: "Independent Sheriff confirms notes syllabus is valid.",
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: "74000000-0000-4000-8000-000000000002" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.newClaimStatus).toBe("under_review");
  });

  it("returns 403 on segregation of duties violation", async () => {
    mockDecideAppeal.mockResolvedValue({
      ok: false,
      code: "SEGREGATION_VIOLATION",
      message:
        "Segregation of duties: You issued the original decision on this claim and cannot review this appeal.",
    });

    const request = new Request("http://localhost/api/sheriff/appeals/appeal-123", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision: "upheld",
        reasonCode: "decision_upheld_policy_violation",
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: "74000000-0000-4000-8000-000000000002" }),
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe("SEGREGATION_VIOLATION");
  });
});
