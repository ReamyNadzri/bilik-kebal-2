import { describe, expect, it, vi } from "vitest";
import type { ValidatedWantedDraftInput } from "@/contracts/marketplace";
import type { WantedActor } from "../domain/wanted-policy";
import type { StoredWantedDraft, WantedRepository } from "../repositories/wanted-repository";
import { WantedPublicationService } from "./wanted-publication-service";

const draftId = "00000000-0000-4000-8000-000000000001";
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
      paymentAvailability: "ready",
    });
    const result = await service.suggestDuplicates(actor, { draftId });
    expect(result).toEqual({
      ok: true,
      data: { token: "x".repeat(43), expiresAt: "2026-09-15T00:15:00.000Z", suggestions: [] },
    });
    expect(repo.storeDuplicateCheck).toHaveBeenCalledWith(
      expect.objectContaining({ draftId, tokenHash: expect.not.stringContaining("x".repeat(20)) }),
    );
  });

  it("preserves the editable draft when payments are disabled", async () => {
    const repo = repository();
    const service = new WantedPublicationService(repo, { paymentAvailability: "disabled" });
    expect(
      await service.preparePublication(actor, {
        draftId,
        duplicateCheckToken: "x".repeat(43),
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
        duplicateCheckToken: "x".repeat(43),
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
        duplicateCheckToken: "x".repeat(43),
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
        duplicateCheckToken: "x".repeat(43),
        initialContributionSen: 100,
      }),
    ).toMatchObject({ ok: false, code });
  });
});
