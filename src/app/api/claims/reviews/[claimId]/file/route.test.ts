import { beforeEach, describe, expect, it, vi } from "vitest";

const factory = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/modules/claims/services/create-claim-file-review-service", () => ({
  createClaimFileReviewService: factory.create,
}));

import { GET } from "./route";

const CLAIM = "00000000-0000-4000-8000-000000000001";
const open = vi.fn();

function call(purpose: string | null) {
  const query = purpose === null ? "" : `?purpose=${purpose}`;
  return GET(new Request(`http://localhost/api/claims/reviews/${CLAIM}/file${query}`), {
    params: Promise.resolve({ claimId: CLAIM }),
  });
}

describe("GET /api/claims/reviews/[claimId]/file", () => {
  beforeEach(() => {
    open.mockReset();
    factory.create.mockReset().mockResolvedValue({ open });
  });

  it("returns the signed URL as private, uncached JSON", async () => {
    open.mockResolvedValue({
      ok: true,
      data: {
        url: "https://project.supabase.co/sign/s",
        expiresAt: "2026-10-03T02:05:00.000Z",
        mimeType: "application/pdf",
      },
    });
    const response = await call("download");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Location")).toBeNull();
    expect(open).toHaveBeenCalledWith(CLAIM, "download");
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: { url: "https://project.supabase.co/sign/s", mimeType: "application/pdf" },
    });
  });

  it.each([
    ["NOT_AUTHORIZED", 403],
    ["CLAIM_NOT_FOUND", 404],
    ["PREVIEW_UNSUPPORTED", 422],
    ["VALIDATION_ERROR", 400],
    ["FILE_UNAVAILABLE", 503],
  ])("maps %s to %i", async (code, status) => {
    open.mockResolvedValue({ ok: false, code, message: "No." });
    const response = await call("view");
    expect(response.status).toBe(status);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("passes a missing purpose through for the service to refuse", async () => {
    open.mockResolvedValue({ ok: false, code: "VALIDATION_ERROR", message: "No." });
    await call(null);
    expect(open).toHaveBeenCalledWith(CLAIM, "");
  });

  it("asks a signed-out caller to sign in", async () => {
    factory.create.mockResolvedValue(null);
    const response = await call("view");
    expect(response.status).toBe(401);
    expect(open).not.toHaveBeenCalled();
  });

  it("reports an unexpected failure without detail", async () => {
    factory.create.mockRejectedValue(new Error("service role key missing"));
    const response = await call("view");
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("service role");
  });
});
