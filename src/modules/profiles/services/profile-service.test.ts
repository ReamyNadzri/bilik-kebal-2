import { describe, expect, it, vi } from "vitest";
import type { PublicProfile } from "@/contracts/profiles";
import type { ProfileRepository } from "../repositories/supabase-profile-repository";
import { ProfileService } from "./profile-service";

const actor = { userId: "00000000-0000-4000-8000-000000000002", emailVerified: true };
const publicId = "11111111-1111-4111-8111-111111111111";
const objectKey = `${publicId}/avatar-1790266488000.webp`;

function repository(overrides: Partial<ProfileRepository> = {}): ProfileRepository {
  return {
    updateOwnProfile: vi.fn().mockResolvedValue(undefined),
    setOwnAvatar: vi.fn().mockResolvedValue(undefined),
    avatarUrl: vi.fn((key: string | null) => (key ? `https://cdn.test/${key}` : null)),
    readPublicProfile: vi.fn().mockResolvedValue(null),
    ownPublicId: vi.fn().mockResolvedValue(publicId),
    createAvatarUpload: vi
      .fn()
      .mockResolvedValue({ signedUrl: "https://storage.test/upload", token: "t" }),
    ...overrides,
  };
}

describe("ProfileService", () => {
  it("saves a trimmed display name and treats an empty bio as none", async () => {
    const repo = repository();
    const result = await new ProfileService(repo).update(actor, {
      displayName: "  Aina  ",
      bio: "",
    });

    expect(result).toEqual({ ok: true, data: { displayName: "Aina", bio: null } });
    expect(repo.updateOwnProfile).toHaveBeenCalledWith("Aina", null);
  });

  it("refuses a display name that is too short", async () => {
    const result = await new ProfileService(repository()).update(actor, { displayName: "A" });

    expect(result).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
  });

  it("records an avatar key that sits in the owner's folder shape", async () => {
    const repo = repository();
    const result = await new ProfileService(repo).setAvatar(actor, { objectKey });

    expect(result).toEqual({ ok: true, data: { avatarUrl: `https://cdn.test/${objectKey}` } });
  });

  it("issues an upload slot inside the member's own folder", async () => {
    const repo = repository();
    const result = await new ProfileService(repo).requestAvatarUpload(actor, () => 1790266488000);

    expect(result).toEqual({
      ok: true,
      data: { objectKey, signedUrl: "https://storage.test/upload", token: "t" },
    });
    expect(repo.createAvatarUpload).toHaveBeenCalledWith(objectKey);
  });

  it("rejects an avatar key outside the expected shape", async () => {
    const repo = repository();
    const result = await new ProfileService(repo).setAvatar(actor, {
      objectKey: "../../claims/quarantine/file.pdf",
    });

    expect(result).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    expect(repo.setOwnAvatar).not.toHaveBeenCalled();
  });

  it("says when the upload never reached storage", async () => {
    const repo = repository({
      setOwnAvatar: vi.fn().mockRejectedValue({ message: "avatar_not_uploaded" }),
    });

    const result = await new ProfileService(repo).setAvatar(actor, { objectKey });

    expect(result).toMatchObject({ ok: false, code: "AVATAR_NOT_UPLOADED" });
  });

  it("shows public profiles only to a verified email, and never private fields", async () => {
    const profile: PublicProfile = {
      publicId,
      displayName: "Aina",
      avatarUrl: null,
      bio: null,
      joinedAt: "2026-09-01T00:00:00.000Z",
      institutionName: "UiTM",
      institutionVerified: true,
      wanted: [],
    };
    const service = new ProfileService(
      repository({ readPublicProfile: vi.fn().mockResolvedValue(profile) }),
    );

    expect(await service.readPublic(null, publicId)).toMatchObject({ code: "AUTH_REQUIRED" });
    expect(await service.readPublic({ ...actor, emailVerified: false }, publicId)).toMatchObject({
      code: "EMAIL_NOT_VERIFIED",
    });
    const result = await service.readPublic(actor, publicId);
    expect(result).toEqual({ ok: true, data: profile });
    expect(JSON.stringify(result)).not.toMatch(/email|user_id|evidence/i);
  });
});
