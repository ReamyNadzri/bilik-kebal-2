import { describe, expect, it, vi } from "vitest";
import type { ValidatedWantedDraftInput } from "@/contracts/marketplace";
import type { StoredWantedDraft, WantedRepository } from "../repositories/wanted-repository";
import type { WantedActor } from "../domain/wanted-policy";
import { WantedDraftService } from "./wanted-draft-service";

const ids = {
  campusId: "00000000-0000-4000-8000-000000000001",
  facultyId: "00000000-0000-4000-8000-000000000002",
  programmeId: "00000000-0000-4000-8000-000000000003",
  courseId: "00000000-0000-4000-8000-000000000004",
  academicSessionId: "00000000-0000-4000-8000-000000000005",
  resourceTypeId: "00000000-0000-4000-8000-000000000006",
  languageId: "00000000-0000-4000-8000-000000000007",
  tagId: "00000000-0000-4000-8000-000000000008",
  draftId: "00000000-0000-4000-8000-000000000009",
  userId: "00000000-0000-4000-8000-000000000010",
  institutionId: "00000000-0000-4000-8000-000000000011",
};

const input = {
  ...ids,
  tagIds: [ids.tagId],
  title: "  CSC510 final exam notes  ",
  description: "  Complete revision notes for the final examination.  ",
  durationDays: 14,
  policyAccepted: true,
};

const actor: WantedActor = {
  userId: ids.userId,
  emailVerified: true,
  institutionId: ids.institutionId,
  institutionVerified: true,
  restricted: false,
};

function stored(
  values: ValidatedWantedDraftInput,
  state: "draft" | "awaiting_payment" = "draft",
): StoredWantedDraft {
  return {
    id: ids.draftId,
    commissionerUserId: ids.userId,
    institutionId: ids.institutionId,
    state,
    values,
    updatedAt: "2026-09-15T00:00:00.000Z",
  };
}

function repository(overrides: Partial<WantedRepository> = {}): WantedRepository {
  return {
    listPublicWanted: vi.fn().mockResolvedValue([]),
    readPublicWanted: vi.fn().mockResolvedValue(null),
    taxonomyMatchesInstitution: vi.fn().mockResolvedValue(true),
    createDraft: vi.fn(async ({ values }) => stored(values)),
    findDraft: vi.fn(async () =>
      stored({
        ...input,
        title: input.title.trim(),
        description: input.description.trim(),
      } as ValidatedWantedDraftInput),
    ),
    updateDraft: vi.fn(async ({ values }) => stored(values)),
    listDuplicateCandidates: vi.fn().mockResolvedValue([]),
    storeDuplicateCheck: vi.fn().mockResolvedValue(undefined),
    preparePublication: vi.fn().mockResolvedValue("required"),
    ...overrides,
  };
}

describe("WantedDraftService", () => {
  it("normalises authored text and derives ownership from the actor", async () => {
    const repo = repository();
    const result = await new WantedDraftService(repo).create(actor, input);

    expect(result).toMatchObject({
      ok: true,
      data: { values: { title: "CSC510 final exam notes" } },
    });
    expect(repo.createDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        commissionerUserId: ids.userId,
        institutionId: ids.institutionId,
      }),
    );
  });

  it.each([
    [null, "AUTH_REQUIRED"],
    [{ ...actor, emailVerified: false }, "EMAIL_NOT_VERIFIED"],
    [{ ...actor, institutionVerified: false }, "INSTITUTION_VERIFICATION_REQUIRED"],
    [{ ...actor, restricted: true }, "ACCOUNT_RESTRICTED"],
  ] as const)("refuses an ineligible actor", async (candidate, code) => {
    const repo = repository();
    expect(await new WantedDraftService(repo).create(candidate, input)).toMatchObject({
      ok: false,
      code,
    });
    expect(repo.createDraft).not.toHaveBeenCalled();
  });

  it("returns field errors for malformed inputs", async () => {
    const result = await new WantedDraftService(repository()).create(actor, {
      ...input,
      durationDays: 10,
      title: "short",
    });
    expect(result).toMatchObject({
      ok: false,
      code: "VALIDATION_ERROR",
      fieldErrors: { durationDays: expect.any(Array), title: expect.any(Array) },
    });
  });

  it("rejects inactive or cross-institution taxonomy", async () => {
    const repo = repository({ taxonomyMatchesInstitution: vi.fn().mockResolvedValue(false) });
    expect(await new WantedDraftService(repo).create(actor, input)).toMatchObject({
      ok: false,
      code: "VALIDATION_ERROR",
    });
    expect(repo.createDraft).not.toHaveBeenCalled();
  });

  it("does not accept caller-supplied commissioner or institution identity", async () => {
    const repo = repository();
    await new WantedDraftService(repo).create(actor, {
      ...input,
      commissionerUserId: "00000000-0000-4000-8000-000000000099",
      institutionId: "00000000-0000-4000-8000-000000000098",
    });
    expect(repo.createDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        commissionerUserId: actor.userId,
        institutionId: actor.institutionId,
      }),
    );
  });

  it("updates only the actor's editable draft", async () => {
    const repo = repository();
    const result = await new WantedDraftService(repo).update(actor, ids.draftId, input);
    expect(result.ok).toBe(true);
    expect(repo.updateDraft).toHaveBeenCalledWith(
      expect.objectContaining({ draftId: ids.draftId, commissionerUserId: actor.userId }),
    );
  });

  it("does not disclose a missing or differently owned draft", async () => {
    const repo = repository({ findDraft: vi.fn().mockResolvedValue(null) });
    expect(await new WantedDraftService(repo).update(actor, ids.draftId, input)).toMatchObject({
      ok: false,
      code: "DRAFT_NOT_FOUND",
    });
  });

  it("refuses updates after publication preparation", async () => {
    const values = {
      ...input,
      title: input.title.trim(),
      description: input.description.trim(),
    } as ValidatedWantedDraftInput;
    const repo = repository({
      findDraft: vi.fn().mockResolvedValue(stored(values, "awaiting_payment")),
    });
    expect(await new WantedDraftService(repo).update(actor, ids.draftId, input)).toMatchObject({
      ok: false,
      code: "DRAFT_NOT_EDITABLE",
    });
  });

  it("maps repository failures without exposing internals", async () => {
    const repo = repository({
      createDraft: vi.fn().mockRejectedValue(new Error("secret database detail")),
    });
    expect(await new WantedDraftService(repo).create(actor, input)).toEqual({
      ok: false,
      code: "MARKETPLACE_UNAVAILABLE",
      message: "The Wanted workspace is temporarily unavailable. Try again.",
    });
  });
});
