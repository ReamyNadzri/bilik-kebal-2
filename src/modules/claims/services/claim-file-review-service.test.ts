import { describe, expect, it, vi } from "vitest";
import { ClaimFileReviewService, type ClaimFileReviewGateway } from "./claim-file-review-service";

const CLAIM = "00000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-10-03T02:00:00.000Z");

function gatewayWith(
  file: { bucket: string; objectKey: string; fileName: string; mimeType: string } = {
    bucket: "quarantine",
    objectKey: "claims/k/notes.pdf",
    fileName: "notes.pdf",
    mimeType: "application/pdf",
  },
): ClaimFileReviewGateway & {
  authorise: ReturnType<typeof vi.fn>;
  sign: ReturnType<typeof vi.fn>;
} {
  return {
    authorise: vi.fn().mockResolvedValue({ ok: true, file }),
    sign: vi.fn().mockResolvedValue({ ok: true, url: "https://project.supabase.co/sign/s" }),
  };
}

const service = (gateway: ClaimFileReviewGateway) => new ClaimFileReviewService(gateway, () => NOW);

describe("ClaimFileReviewService", () => {
  it("authorises through the database, then signs a five-minute URL", async () => {
    const gateway = gatewayWith();
    await expect(service(gateway).open(CLAIM, "view")).resolves.toEqual({
      ok: true,
      data: {
        url: "https://project.supabase.co/sign/s",
        expiresAt: "2026-10-03T02:05:00.000Z",
        mimeType: "application/pdf",
      },
    });
    expect(gateway.authorise).toHaveBeenCalledWith(CLAIM, "view");
    expect(gateway.sign).toHaveBeenCalledWith(
      { bucket: "quarantine", objectKey: "claims/k/notes.pdf", status: "under_review" },
      300,
      undefined,
    );
  });

  it("names the saved file for a download", async () => {
    const gateway = gatewayWith();
    await service(gateway).open(CLAIM, "download");
    expect(gateway.sign).toHaveBeenCalledWith(expect.anything(), 300, { download: "notes.pdf" });
  });

  it("lets an approved claim's file be repaired from quarantine", async () => {
    const gateway = gatewayWith({
      bucket: "approved",
      objectKey: "k",
      fileName: "a.png",
      mimeType: "image/png",
    });
    await service(gateway).open(CLAIM, "view");
    expect(gateway.sign).toHaveBeenCalledWith(
      { bucket: "approved", objectKey: "k", status: "approved" },
      300,
      undefined,
    );
  });

  it("refuses to show an Office file in the browser and signs nothing", async () => {
    const gateway = gatewayWith({
      bucket: "quarantine",
      objectKey: "k",
      fileName: "notes.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    await expect(service(gateway).open(CLAIM, "view")).resolves.toMatchObject({
      ok: false,
      code: "PREVIEW_UNSUPPORTED",
    });
    expect(gateway.sign).not.toHaveBeenCalled();
  });

  it.each([
    ["forbidden", "NOT_AUTHORIZED"],
    ["not_found", "CLAIM_NOT_FOUND"],
    ["auth", "AUTH_REQUIRED"],
    ["invalid", "VALIDATION_ERROR"],
    ["unavailable", "FILE_UNAVAILABLE"],
  ] as const)("maps a %s refusal to %s and signs nothing", async (reason, code) => {
    const gateway = gatewayWith();
    gateway.authorise.mockResolvedValueOnce({ ok: false, reason });
    await expect(service(gateway).open(CLAIM, "download")).resolves.toMatchObject({
      ok: false,
      code,
    });
    expect(gateway.sign).not.toHaveBeenCalled();
  });

  it("rejects a malformed claim id or purpose without calling the database", async () => {
    const gateway = gatewayWith();
    await expect(service(gateway).open("nope", "view")).resolves.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    await expect(service(gateway).open(CLAIM, "preview")).resolves.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(gateway.authorise).not.toHaveBeenCalled();
  });

  it("reports a signing failure as unavailable", async () => {
    const gateway = gatewayWith();
    gateway.sign.mockResolvedValueOnce({ ok: false, reason: "failed" });
    await expect(service(gateway).open(CLAIM, "download")).resolves.toMatchObject({
      ok: false,
      code: "FILE_UNAVAILABLE",
    });
  });
});
