import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { ValidatedWantedDraftInput } from "@/contracts/marketplace";
import type { WantedActor } from "../domain/wanted-policy";
import type { StoredWantedDraft, WantedRepository } from "../repositories/wanted-repository";
import { WantedPublicationService } from "./wanted-publication-service";

const draftId = "00000000-0000-4000-8000-000000000001";
const nonce = "x".repeat(43);
const validToken = `${nonce}.${createHmac("sha256", "vaultix-local-marketplace-token-secret")
  .update(nonce)
  .digest("hex")}`;
const actor: WantedActor = {
  userId: "00000000-0000-4000-8000-000000000002",
  emailVerified: true,
  institutionId: "00000000-0000-4000-8000-000000000003",
  institutionVerified: true,
  restricted: false,
};
const values: ValidatedWantedDraftInput = {
  campusId: "00000000-0000-4000-8000-000000000004",
  facultyId: "00000000-0000-4000-8000-000000000005",
  programmeId: "00000000-0000-4000-8000-000000000006",
  courseId: "00000000-0000-4000-8000-000000000007",
  academicSessionId: "00000000-0000-4000-8000-000000000008",
  resourceTypeId: "00000000-0000-4000-8000-000000000009",
  languageId: "00000000-0000-4000-8000-000000000010",
  tagIds: [],
  title: "CSC510 final notes",
  description: "Complete final examination notes for CSC510.",
  durationDays: 14,
  policyAccepted: true,
};
const draft: StoredWantedDraft = {
  commissionerUserId: actor.userId,
  id: draftId,
  institutionId: actor.institutionId!,
  state: "draft",
  updatedAt: "2026-09-15T00:00:00.000Z",
  values,
};

function repository(overrides: Partial<WantedRepository> = {}): WantedRepository {
  return {
    listPublicWanted: vi.fn().mockResolvedValue([]),
    readPublicWanted: vi.fn().mockResolvedValue(null),
    taxonomyMatchesInstitution: vi.fn().mockResolvedValue(true),
    createDraft: vi.fn(),
    findDraft: vi.fn().mockResolvedValue(draft),
    updateDraft: vi.fn(),
    listDuplicateCandidates: vi.fn().mockResolvedValue([]),
    storeDuplicateCheck: vi.fn().mockResolvedValue(undefined),
    preparePublication: vi.fn().mockResolvedValue("prepared"),
    ...overrides,
  };
}

describe("WantedPublicationService", () => {
  it("issues an expiring opaque duplicate token without returning stored hashes", async () => {
    const repo = repository();
    const service = new WantedPublicationService(repo, {
      now: () => new Date("2026-09-15T00:00:00.000Z"),
      token: () => "x".repeat(43),
      tokenSecret: "test-marketplace-token-secret-32-chars",
      paymentAvailability: "ready",
    });
    const result = await service.suggestDuplicates(actor, { draftId });
    expect(result).toMatchObject({
      ok: true,
      data: { expiresAt: "2026-09-15T00:15:00.000Z", suggestions: [] },
    });
    expect(result.ok && result.data.token).toMatch(/^x{43}\.[0-9a-f]{64}$/);
    expect(repo.storeDuplicateCheck).toHaveBeenCalledWith(
      expect.objectContaining({ draftId, tokenHash: expect.not.stringContaining("x".repeat(20)) }),
    );
  });

  it("refuses a forged client-created token before the publication transaction", async () => {
    const repo = repository();
    const service = new WantedPublicationService(repo, {
      paymentAvailability: "ready",
      tokenSecret: "test-marketplace-token-secret-32-chars",
    });
    expect(
      await service.preparePublication(actor, {
        draftId,
        duplicateCheckToken: "client-created-token-without-a-valid-signature",
        initialContributionSen: 100,
      }),
    ).toMatchObject({ ok: false, code: "DUPLICATE_CHECK_REQUIRED" });
    expect(repo.preparePublication).not.toHaveBeenCalled();
  });

  it("preserves the editable draft when payments are disabled", async () => {
    const repo = repository();
    const service = new WantedPublicationService(repo, { paymentAvailability: "disabled" });
    expect(
      await service.preparePublication(actor, {
        draftId,
        duplicateCheckToken: validToken,
        initialContributionSen: 100,
      }),
    ).toMatchObject({ ok: false, code: "PAYMENT_DISABLED" });
    expect(repo.preparePublication).not.toHaveBeenCalled();
  });

  it.each([99, 5001])("refuses an out-of-range %i-sen contribution", async (amount) => {
    const service = new WantedPublicationService(repository(), { paymentAvailability: "ready" });
    expect(
      await service.preparePublication(actor, {
        draftId,
        duplicateCheckToken: validToken,
        initialContributionSen: amount,
      }),
    ).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
  });

  it.each([100, 5000])(
    "freezes policy, fee, duration and access snapshots at %i sen",
    async (amount) => {
      const repo = repository();
      const service = new WantedPublicationService(repo, {
        paymentAvailability: "ready",
        feeRateBasisPoints: 1000,
        policyVersion: "2026-09-15.1",
      });
      const result = await service.preparePublication(actor, {
        draftId,
        duplicateCheckToken: validToken,
        initialContributionSen: amount,
      });
      expect(result).toMatchObject({ ok: true, data: { draftId, state: "awaiting_payment" } });
      expect(repo.preparePublication).toHaveBeenCalledWith(
        expect.objectContaining({
          accessBasis: "contributors_only",
          amountSen: amount,
          durationDays: 14,
          feeRateBasisPoints: 1000,
          policyVersion: "2026-09-15.1",
        }),
      );
    },
  );

  it.each([
    ["expired", "DUPLICATE_CHECK_EXPIRED"],
    ["required", "DUPLICATE_CHECK_REQUIRED"],
  ] as const)("maps a %s token without opening the Wanted", async (repositoryResult, code) => {
    const repo = repository({ preparePublication: vi.fn().mockResolvedValue(repositoryResult) });
    const service = new WantedPublicationService(repo, { paymentAvailability: "ready" });
    expect(
      await service.preparePublication(actor, {
        draftId,
        duplicateCheckToken: validToken,
        initialContributionSen: 100,
      }),
    ).toMatchObject({ ok: false, code });
  });
});

describe("WantedPublicationService.publishFree", () => {
  const publisher = (outcome: "published" | "required" | "expired") => ({
    publishFree: vi.fn().mockResolvedValue({
      outcome,
      publicId: outcome === "published" ? "11111111-1111-4111-8111-111111111111" : null,
    }),
  });

  it("opens the draft with no payment step, even while payments are disabled", async () => {
    const free = publisher("published");
    const service = new WantedPublicationService(repository(), {
      paymentAvailability: "disabled",
      freePublisher: free,
    });

    const result = await service.publishFree(actor, { draftId, duplicateCheckToken: validToken });

    expect(result).toEqual({
      ok: true,
      data: { state: "open", wantedId: "11111111-1111-4111-8111-111111111111" },
    });
    expect(free.publishFree).toHaveBeenCalledWith(
      expect.objectContaining({ draftId, policyVersion: "2026-09-24.2" }),
    );
  });

  it("refuses a forged duplicate token before touching the database", async () => {
    const free = publisher("published");
    const service = new WantedPublicationService(repository(), {
      paymentAvailability: "disabled",
      freePublisher: free,
    });

    const result = await service.publishFree(actor, {
      draftId,
      duplicateCheckToken: `${nonce}.${"0".repeat(64)}`,
    });

    expect(result).toMatchObject({ ok: false, code: "DUPLICATE_CHECK_REQUIRED" });
    expect(free.publishFree).not.toHaveBeenCalled();
  });

  it("reports an expired duplicate check rather than publishing", async () => {
    const service = new WantedPublicationService(repository(), {
      paymentAvailability: "disabled",
      freePublisher: publisher("expired"),
    });

    const result = await service.publishFree(actor, { draftId, duplicateCheckToken: validToken });

    expect(result).toMatchObject({ ok: false, code: "DUPLICATE_CHECK_EXPIRED" });
  });

  it("requires institution verification", async () => {
    const service = new WantedPublicationService(repository(), {
      paymentAvailability: "disabled",
      freePublisher: publisher("published"),
    });

    const result = await service.publishFree(
      { ...actor, institutionVerified: false },
      { draftId, duplicateCheckToken: validToken },
    );

    expect(result).toMatchObject({ ok: false, code: "INSTITUTION_VERIFICATION_REQUIRED" });
  });
});
