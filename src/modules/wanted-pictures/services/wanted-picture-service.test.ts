import { describe, expect, test, vi } from "vitest";
import { WantedPictureService, type WantedPictureRepository } from "./wanted-picture-service";

const actor = { userId: "u1" };
const wantedId = "30000000-0000-4000-8000-000000000001";
const publicId = "40000000-0000-4000-8000-000000000001";
const objectKey = `${publicId}/50000000-0000-4000-8000-000000000001.png`;

function repository(overrides: Partial<WantedPictureRepository> = {}): WantedPictureRepository {
  return {
    ownPublicId: vi.fn(async () => publicId),
    createUpload: vi.fn(async () => ({ signedUrl: "https://storage.test/upload" })),
    setOwn: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("WantedPictureService", () => {
  test("prepares an upload slot inside the caller's own folder", async () => {
    const repo = repository();
    const result = await new WantedPictureService(repo).prepareUpload(actor);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.objectKey).toMatch(new RegExp(`^${publicId}/[0-9a-f-]{36}\\.png$`));
    expect(repo.createUpload).toHaveBeenCalledWith(result.data.objectKey);
  });

  test("refuses signed-out callers", async () => {
    const service = new WantedPictureService(repository());
    expect((await service.prepareUpload(null)).ok).toBe(false);
    expect(await service.set(null, wantedId, { preset: 1, objectKey: null })).toMatchObject({
      code: "AUTH_REQUIRED",
    });
  });

  test.each([
    [{ preset: 3, objectKey: null }, [wantedId, 3, null]],
    [{ preset: null, objectKey }, [wantedId, null, objectKey]],
    [{ preset: null, objectKey: null }, [wantedId, null, null]],
  ])("saves %j", async (input, expected) => {
    const repo = repository();
    const result = await new WantedPictureService(repo).set(actor, wantedId, input);
    expect(result.ok).toBe(true);
    expect(repo.setOwn).toHaveBeenCalledWith(...expected);
  });

  test.each([
    { preset: 50, objectKey: null },
    { preset: -1, objectKey: null },
    { preset: 2, objectKey },
    { preset: null, objectKey: "someone-else/../x.png" },
  ])("refuses %j before the database", async (input) => {
    const repo = repository();
    const result = await new WantedPictureService(repo).set(actor, wantedId, input);
    expect(result).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    expect(repo.setOwn).not.toHaveBeenCalled();
  });

  test("maps a refusal for someone else's Wanted", async () => {
    const repo = repository({
      setOwn: vi.fn(async () => {
        throw { message: "wanted_picture_not_found" };
      }),
    });
    const result = await new WantedPictureService(repo).set(actor, wantedId, {
      preset: 1,
      objectKey: null,
    });
    expect(result).toMatchObject({ ok: false, code: "WANTED_NOT_FOUND" });
  });

  test("a removal needs a reason code, and the database decides who may remove", async () => {
    const repo = repository({
      remove: vi.fn(async () => {
        throw { message: "wanted_picture_moderator_required" };
      }),
    });
    const service = new WantedPictureService(repo);
    expect(await service.remove(actor, wantedId, { reasonCode: "Bad!" })).toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(await service.remove(actor, wantedId, { reasonCode: "offensive_image" })).toMatchObject({
      code: "NOT_AUTHORIZED",
    });
    expect(repo.remove).toHaveBeenCalledWith(wantedId, "offensive_image");
  });
});
