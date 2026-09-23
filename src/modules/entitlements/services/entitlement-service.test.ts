import { describe, expect, it, vi } from "vitest";
import type {
  ClaimDownloadMeta,
  EntitlementRepository,
} from "../repositories/entitlement-repository";
import { EntitlementService } from "./entitlement-service";

describe("EntitlementService", () => {
  const mockClaimMeta: ClaimDownloadMeta = {
    id: "claim-1",
    wantedRequestId: "wanted-1",
    hunterUserId: "hunter-1",
    institutionId: "inst-1",
    isRestricted: false,
    freeReleaseOptIn: false,
    rightsConfirmedAt: null,
    status: "approved",
    bucket: "approved",
    objectKey: "claims/claim-1.pdf",
    fileName: "lecture-notes.pdf",
    sizeBytes: 1048576,
    mimeType: "application/pdf",
  };

  const createMockRepo = (overrides?: Partial<EntitlementRepository>): EntitlementRepository => ({
    getClaimDownloadMeta: vi.fn().mockResolvedValue(mockClaimMeta),
    getEntitlement: vi.fn().mockResolvedValue({
      id: "ent-1",
      wantedRequestId: "wanted-1",
      claimId: "claim-1",
      userId: "user-contributor",
      grantedAt: "2026-09-24T00:00:00Z",
      isRevoked: false,
      revokedAt: null,
      revocationReason: null,
    }),
    isStaff: vi.fn().mockResolvedValue(false),
    createSignedDownloadUrl: vi.fn().mockResolvedValue("https://storage.supabase.co/signed-url"),
    revokeEntitlementsForWanted: vi.fn().mockResolvedValue(3),
    ...overrides,
  });

  it("returns signed download URL for entitled contributor", () => {
    const repo = createMockRepo();
    const service = new EntitlementService(repo);

    return expect(
      service.getClaimDownloadUrl("user-contributor", "claim-1"),
    ).resolves.toMatchObject({
      ok: true,
      data: {
        downloadUrl: "https://storage.supabase.co/signed-url",
        fileName: "lecture-notes.pdf",
        expiresInSeconds: 900,
      },
    });
  });

  it("returns NOT_FOUND if claim does not exist", () => {
    const repo = createMockRepo({
      getClaimDownloadMeta: vi.fn().mockResolvedValue(null),
    });
    const service = new EntitlementService(repo);

    return expect(
      service.getClaimDownloadUrl("user-contributor", "claim-missing"),
    ).resolves.toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
  });

  it("returns RESTRICTED if claim is quarantined and caller is neither hunter nor staff", () => {
    const repo = createMockRepo({
      getClaimDownloadMeta: vi.fn().mockResolvedValue({
        ...mockClaimMeta,
        bucket: "quarantine",
      }),
      isStaff: vi.fn().mockResolvedValue(false),
    });
    const service = new EntitlementService(repo);

    return expect(
      service.getClaimDownloadUrl("user-contributor", "claim-1"),
    ).resolves.toMatchObject({
      ok: false,
      code: "RESTRICTED",
    });
  });

  it("returns REVOKED if user's entitlement was revoked", () => {
    const repo = createMockRepo({
      getEntitlement: vi.fn().mockResolvedValue({
        id: "ent-1",
        wantedRequestId: "wanted-1",
        claimId: "claim-1",
        userId: "user-contributor",
        grantedAt: "2026-09-24T00:00:00Z",
        isRevoked: true,
        revokedAt: "2026-09-25T00:00:00Z",
        revocationReason: "Takedown enforcement",
      }),
    });
    const service = new EntitlementService(repo);

    return expect(
      service.getClaimDownloadUrl("user-contributor", "claim-1"),
    ).resolves.toMatchObject({
      ok: false,
      code: "REVOKED",
      message: "Takedown enforcement",
    });
  });

  it("returns NOT_ENTITLED if user has no entitlement and claim is not free release", () => {
    const repo = createMockRepo({
      getEntitlement: vi.fn().mockResolvedValue(null),
    });
    const service = new EntitlementService(repo);

    return expect(service.getClaimDownloadUrl("random-user", "claim-1")).resolves.toMatchObject({
      ok: false,
      code: "NOT_ENTITLED",
    });
  });

  it("returns STORAGE_ERROR if signed URL creation throws", () => {
    const repo = createMockRepo({
      createSignedDownloadUrl: vi.fn().mockRejectedValue(new Error("Storage unavailable")),
    });
    const service = new EntitlementService(repo);

    return expect(
      service.getClaimDownloadUrl("user-contributor", "claim-1"),
    ).resolves.toMatchObject({
      ok: false,
      code: "STORAGE_ERROR",
    });
  });

  it("calls revokeEntitlementsForWanted on repository", async () => {
    const repo = createMockRepo();
    const service = new EntitlementService(repo);

    const count = await service.revokeEntitlements("wanted-1", "Copyright claim");
    expect(count).toBe(3);
    expect(repo.revokeEntitlementsForWanted).toHaveBeenCalledWith("wanted-1", "Copyright claim");
  });
});
