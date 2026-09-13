import { describe, expect, test, vi } from "vitest";

import { EvidenceUploadService, type EvidenceUploadGateway } from "./evidence-upload-service";

const userId = "00000000-0000-4000-8000-000000000001";

function createGateway(): EvidenceUploadGateway {
  return {
    createSignedUpload: vi.fn().mockResolvedValue({
      signedUrl: "http://127.0.0.1:55421/storage/v1/upload/sign/test",
      token: "synthetic-upload-token",
    }),
  };
}

describe("EvidenceUploadService", () => {
  test("requires verified email ownership", async () => {
    const gateway = createGateway();
    const service = new EvidenceUploadService(gateway, () => "generated-id");

    const result = await service.createUpload({
      emailVerified: false,
      fileName: "student-card.pdf",
      mimeType: "application/pdf",
      userId,
    });

    expect(result).toMatchObject({ ok: false, code: "EMAIL_NOT_VERIFIED" });
    expect(gateway.createSignedUpload).not.toHaveBeenCalled();
  });

  test("rejects evidence formats outside the private bucket allowlist", async () => {
    const gateway = createGateway();
    const service = new EvidenceUploadService(gateway, () => "generated-id");

    const result = await service.createUpload({
      emailVerified: true,
      fileName: "student-card.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      userId,
    });

    expect(result).toMatchObject({ ok: false, code: "UNSUPPORTED_EVIDENCE_TYPE" });
    expect(gateway.createSignedUpload).not.toHaveBeenCalled();
  });

  test("generates the object key server-side instead of trusting the filename", async () => {
    const gateway = createGateway();
    const service = new EvidenceUploadService(gateway, () => "generated-id");

    const result = await service.createUpload({
      emailVerified: true,
      fileName: "../../private.png",
      mimeType: "image/png",
      userId,
    });

    expect(gateway.createSignedUpload).toHaveBeenCalledWith({
      mimeType: "image/png",
      objectPath: `${userId}/generated-id.png`,
    });
    expect(result).toEqual({
      ok: true,
      data: {
        objectPath: `${userId}/generated-id.png`,
        signedUrl: "http://127.0.0.1:55421/storage/v1/upload/sign/test",
        token: "synthetic-upload-token",
      },
    });
  });
});
