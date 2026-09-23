import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mockGetClaimDownloadUrl = vi.fn();

vi.mock("@/modules/entitlements/services/create-entitlement-service", () => ({
  createEntitlementService: vi.fn().mockImplementation(async () => ({
    service: {
      getClaimDownloadUrl: mockGetClaimDownloadUrl,
    },
    userId: "user-123",
  })),
}));

describe("GET /api/claims/[id]/download", () => {
  it("returns download URL when user is entitled", async () => {
    mockGetClaimDownloadUrl.mockResolvedValue({
      ok: true,
      data: {
        downloadUrl: "https://storage.supabase.co/signed-download-url",
        fileName: "notes.pdf",
        sizeBytes: 1024,
        mimeType: "application/pdf",
        expiresInSeconds: 900,
      },
    });

    const request = new Request("http://localhost/api/claims/claim-123/download");
    const response = await GET(request, {
      params: Promise.resolve({ id: "claim-123" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.downloadUrl).toContain("signed-download-url");
  });

  it("returns 403 when user is not entitled", async () => {
    mockGetClaimDownloadUrl.mockResolvedValue({
      ok: false,
      code: "NOT_ENTITLED",
      error: "Contribution required",
    });

    const request = new Request("http://localhost/api/claims/claim-123/download");
    const response = await GET(request, {
      params: Promise.resolve({ id: "claim-123" }),
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe("NOT_ENTITLED");
  });

  it("returns 403 when claim is restricted", async () => {
    mockGetClaimDownloadUrl.mockResolvedValue({
      ok: false,
      code: "RESTRICTED",
      error: "Claim is restricted",
    });

    const request = new Request("http://localhost/api/claims/claim-123/download");
    const response = await GET(request, {
      params: Promise.resolve({ id: "claim-123" }),
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe("RESTRICTED");
  });
});
