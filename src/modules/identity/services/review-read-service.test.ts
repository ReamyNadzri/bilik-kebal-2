import { describe, expect, test, vi } from "vitest";

import type { VerificationActor } from "./verification-service";
import { EvidenceReadService, canLoadReviewQueue } from "./review-read-service";

const ordinaryActor: VerificationActor = {
  authenticatedAt: "2026-09-14T00:00:00.000Z",
  institutionSheriffFor: [],
  platformRole: null,
  userId: "00000000-0000-4000-8000-000000000001",
};

describe("review read access", () => {
  test("does not expose the review queue to an ordinary applicant", () => {
    expect(canLoadReviewQueue(ordinaryActor)).toBe(false);
  });

  test("permits platform and institution-scoped reviewers to load the queue", () => {
    expect(canLoadReviewQueue({ ...ordinaryActor, platformRole: "platform_sheriff" })).toBe(true);
    expect(canLoadReviewQueue({ ...ordinaryActor, institutionSheriffFor: ["institution-1"] })).toBe(
      true,
    );
  });
});

describe("EvidenceReadService", () => {
  test("returns an opaque short-lived URL without exposing the object path", async () => {
    const repository = {
      authoriseEvidenceRead: vi.fn().mockResolvedValue({
        status: "authorised",
        objectPath: "private/object.png",
      }),
    };
    const signer = {
      createSignedReadUrl: vi.fn().mockResolvedValue("https://storage.test/signed"),
    };
    const service = new EvidenceReadService(
      repository,
      signer,
      () => new Date("2026-09-14T00:00:00Z"),
    );

    const result = await service.createEvidenceUrl(
      { requestId: "00000000-0000-4000-8000-000000000002" },
      ordinaryActor,
    );

    expect(result).toEqual({
      ok: true,
      data: {
        expiresAt: "2026-09-14T00:05:00.000Z",
        signedUrl: "https://storage.test/signed",
      },
    });
    expect(JSON.stringify(result)).not.toContain("private/object.png");
  });

  test("maps an expired evidence record without asking storage for a URL", async () => {
    const repository = {
      authoriseEvidenceRead: vi.fn().mockResolvedValue({ status: "expired" }),
    };
    const signer = { createSignedReadUrl: vi.fn() };
    const service = new EvidenceReadService(repository, signer, () => new Date());

    const result = await service.createEvidenceUrl(
      { requestId: "00000000-0000-4000-8000-000000000002" },
      ordinaryActor,
    );

    expect(result).toMatchObject({ ok: false, code: "EVIDENCE_EXPIRED" });
    expect(signer.createSignedReadUrl).not.toHaveBeenCalled();
  });
});
