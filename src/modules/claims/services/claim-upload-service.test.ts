import { describe, expect, it, vi } from "vitest";
import type { ValidatedClaimSubmissionInput } from "@/contracts/claims";
import { ClaimUploadService } from "./claim-upload-service";

const input: ValidatedClaimSubmissionInput = {
  wantedId: "74000000-0000-4000-8000-000000000001",
  fileName: "notes.pdf",
  mimeType: "application/pdf",
  sizeBytes: 100,
  sha256: "a".repeat(64),
  rightsConfirmed: true,
  freeReleaseOptIn: false,
};

const actor = {
  userId: "71000000-0000-4000-8000-000000000002",
  institutionId: "72000000-0000-4000-8000-000000000001",
  emailVerified: true,
  institutionVerified: true,
  restricted: false,
};

function service(overrides: Partial<ConstructorParameters<typeof ClaimUploadService>[0]> = {}) {
  return new ClaimUploadService({
    uploadsEnabled: true,
    now: () => new Date("2026-09-20T00:00:00Z"),
    generateId: () => "83000000-0000-4000-8000-000000000001",
    repository: {
      createClaim: vi.fn().mockResolvedValue({
        claimId: "83000000-0000-4000-8000-000000000001",
        objectKey: "83000000-0000-4000-8000-000000000001/original.pdf",
      }),
    },
    gateway: {
      createSignedUpload: vi.fn().mockResolvedValue({
        signedUrl: "https://storage.test/upload",
        token: "signed-token",
      }),
    },
    ...overrides,
  });
}

describe("ClaimUploadService", () => {
  it("refuses upload sessions while the public upload gate is disabled", async () => {
    const repository = { createClaim: vi.fn() };
    const result = await service({ uploadsEnabled: false, repository }).create(
      actor,
      "open",
      input,
    );
    expect(result).toMatchObject({ ok: false, code: "UPLOAD_UNAVAILABLE" });
    expect(repository.createClaim).not.toHaveBeenCalled();
  });

  it("requires an eligible claimant and an open Wanted", async () => {
    const result = await service().create({ ...actor, institutionVerified: false }, "open", input);
    expect(result).toMatchObject({ ok: false, code: "INSTITUTION_VERIFICATION_REQUIRED" });
    await expect(service().create(actor, "reviewing", input)).resolves.toMatchObject({
      ok: false,
      code: "WANTED_NOT_OPEN",
    });
  });

  it("creates an opaque quarantine upload session without exposing storage internals", async () => {
    const result = await service().create(actor, "open", input);
    expect(result).toMatchObject({
      ok: true,
      data: {
        claimId: "83000000-0000-4000-8000-000000000001",
        bucket: "quarantine",
        signedUrl: "https://storage.test/upload",
        token: "signed-token",
        maxBytes: 52428800,
      },
    });
    expect(JSON.stringify(result)).not.toContain("objectKey");
  });
});
