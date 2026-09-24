import { describe, expect, it, vi } from "vitest";
import type { WantedActor } from "../domain/wanted-policy";
import { WantedCommunityService, type CommunityWantedRepository } from "./wanted-community-service";

const actor: WantedActor = {
  userId: "00000000-0000-4000-8000-000000000002",
  emailVerified: true,
  institutionId: "00000000-0000-4000-8000-000000000003",
  institutionVerified: true,
  restricted: false,
};
const campusId = "00000000-0000-4000-8000-000000000004";
const publicId = "11111111-1111-4111-8111-111111111111";

function repository(overrides: Partial<CommunityWantedRepository> = {}): CommunityWantedRepository {
  return {
    publishCommunityWanted: vi.fn().mockResolvedValue(publicId),
    listReplies: vi.fn().mockResolvedValue([]),
    postReply: vi.fn().mockResolvedValue("reply-1"),
    resolveCommunityWanted: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const missingItem = {
  kind: "missing_item",
  campusId,
  title: "Lost blue water bottle",
  description: "Left it in the library study room on level 2 on Monday afternoon.",
  durationDays: 7,
  lastSeenLocation: "Library level 2",
  policyAccepted: true,
};

describe("WantedCommunityService", () => {
  it("opens a missing-item Wanted with its last-seen location", async () => {
    const repo = repository();
    const result = await new WantedCommunityService(repo).publish(actor, missingItem);

    expect(result).toEqual({ ok: true, data: { state: "open", wantedId: publicId } });
    expect(repo.publishCommunityWanted).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "missing_item", lastSeenLocation: "Library level 2" }),
    );
  });

  it("drops a last-seen location from a discussion", async () => {
    const repo = repository();
    await new WantedCommunityService(repo).publish(actor, { ...missingItem, kind: "discussion" });

    expect(repo.publishCommunityWanted).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "discussion", lastSeenLocation: null }),
    );
  });

  it("never accepts an academic kind on the community route", async () => {
    const result = await new WantedCommunityService(repository()).publish(actor, {
      ...missingItem,
      kind: "academic",
    });

    expect(result).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
  });

  it("requires the terms to be accepted", async () => {
    const result = await new WantedCommunityService(repository()).publish(actor, {
      ...missingItem,
      policyAccepted: false,
    });

    expect(result).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
  });

  it("explains a closed region instead of a generic failure", async () => {
    const repo = repository({
      publishCommunityWanted: vi.fn().mockRejectedValue({ message: "wanted_region_closed" }),
    });

    const result = await new WantedCommunityService(repo).publish(actor, missingItem);

    expect(result).toMatchObject({ ok: false, code: "REGION_CLOSED" });
  });

  it("requires institution verification to post or reply", async () => {
    const unverified = { ...actor, institutionVerified: false };
    const service = new WantedCommunityService(repository());

    expect(await service.publish(unverified, missingItem)).toMatchObject({
      ok: false,
      code: "INSTITUTION_VERIFICATION_REQUIRED",
    });
    expect(await service.reply(unverified, publicId, { body: "I saw it" })).toMatchObject({
      ok: false,
      code: "INSTITUTION_VERIFICATION_REQUIRED",
    });
  });

  it("refuses a reply that is too short", async () => {
    const result = await new WantedCommunityService(repository()).reply(actor, publicId, {
      body: "x",
    });

    expect(result).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
  });

  it("lets only a signed-in, email-verified viewer read replies", async () => {
    const service = new WantedCommunityService(repository());

    expect(await service.listReplies(null, publicId)).toMatchObject({ code: "AUTH_REQUIRED" });
    expect(await service.listReplies({ ...actor, emailVerified: false }, publicId)).toMatchObject({
      code: "EMAIL_NOT_VERIFIED",
    });
    expect(await service.listReplies(actor, publicId)).toEqual({ ok: true, data: [] });
  });

  it("reports that only the poster can resolve", async () => {
    const repo = repository({
      resolveCommunityWanted: vi.fn().mockRejectedValue({ message: "wanted_not_resolvable" }),
    });

    const result = await new WantedCommunityService(repo).resolve(actor, publicId);

    expect(result).toMatchObject({ ok: false, code: "NOT_AUTHORIZED" });
  });
});
