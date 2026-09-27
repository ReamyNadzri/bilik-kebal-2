import { describe, expect, it, vi } from "vitest";
import type { PublicHunter } from "@/contracts/profiles";
import { HuntersService, type HuntersRepository } from "./hunters-service";

const actor = { userId: "00000000-0000-4000-8000-000000000002", emailVerified: true };

function hunter(index: number): PublicHunter {
  return {
    publicId: `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`,
    displayName: `Hunter ${index}`,
    avatarUrl: null,
    institutionName: "UiTM Shah Alam",
    joinedAt: "2024-03-01T00:00:00.000Z",
  };
}

function hunters(from: number, count: number): PublicHunter[] {
  return Array.from({ length: count }, (_, offset) => hunter(from + offset));
}

function repository(listPage: HuntersRepository["listPage"]): HuntersRepository {
  return { listPage: vi.fn(listPage) };
}

describe("HuntersService.list", () => {
  it("refuses a signed-out viewer and an unverified email before reading", async () => {
    const repo = repository(async () => ({ total: 0, items: [] }));
    const service = new HuntersService(repo);

    expect(await service.list(null, { page: 1, pageSize: 10 })).toMatchObject({
      ok: false,
      code: "AUTH_REQUIRED",
    });
    expect(
      await service.list({ ...actor, emailVerified: false }, { page: 1, pageSize: 10 }),
    ).toMatchObject({ ok: false, code: "EMAIL_NOT_VERIFIED" });
    expect(repo.listPage).not.toHaveBeenCalled();
  });

  it.each([
    { page: 1, pageSize: 12 },
    { page: 0, pageSize: 10 },
    { page: 1.5, pageSize: 10 },
    { page: Number.NaN, pageSize: 20 },
  ])("rejects $pageSize per page on page $page", async (input) => {
    const repo = repository(async () => ({ total: 0, items: [] }));
    const result = await new HuntersService(repo).list(actor, input);

    expect(result).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    expect(repo.listPage).not.toHaveBeenCalled();
  });

  it("returns the page it was asked for", async () => {
    const repo = repository(async () => ({ total: 44, items: hunters(16, 15) }));
    const result = await new HuntersService(repo).list(actor, { page: 2, pageSize: 15 });

    expect(repo.listPage).toHaveBeenCalledWith(15, 2);
    expect(result).toEqual({
      ok: true,
      data: { total: 44, page: 2, pageSize: 15, items: hunters(16, 15) },
    });
  });

  it("serves the last page when an old link points past the end", async () => {
    const repo = repository(async (_size, page) =>
      page === 3 ? { total: 24, items: hunters(21, 4) } : { total: 24, items: [] },
    );
    const result = await new HuntersService(repo).list(actor, { page: 9, pageSize: 10 });

    expect(repo.listPage).toHaveBeenLastCalledWith(10, 3);
    expect(result).toMatchObject({ ok: true, data: { page: 3, total: 24 } });
  });

  it("reads the database's email refusal as a refusal, anything else as unavailable", async () => {
    const refused = repository(async () => {
      throw { message: "EMAIL_NOT_VERIFIED" };
    });
    const broken = repository(async () => {
      throw new Error("connection reset");
    });

    expect(await new HuntersService(refused).list(actor, { page: 1, pageSize: 10 })).toMatchObject({
      ok: false,
      code: "EMAIL_NOT_VERIFIED",
    });
    expect(await new HuntersService(broken).list(actor, { page: 1, pageSize: 10 })).toMatchObject({
      ok: false,
      code: "PROFILE_UNAVAILABLE",
    });
  });
});

describe("HuntersService.sample", () => {
  it("shuffles every Hunter when there are twenty or fewer, and keeps the count", async () => {
    const repo = repository(async () => ({ total: 8, items: hunters(1, 8) }));
    const result = await new HuntersService(repo).sample(actor, 6, () => 0);

    expect(repo.listPage).toHaveBeenCalledTimes(1);
    expect(result.ok && result.data).toHaveLength(6);
    expect(result.ok && result.data.map((item) => item.displayName)).not.toEqual(
      hunters(1, 6).map((item) => item.displayName),
    );
  });

  it("draws from a random page of twenty when there are more", async () => {
    const repo = repository(async (_size, page) => ({
      total: 55,
      items: hunters((page - 1) * 20 + 1, page === 3 ? 15 : 20),
    }));
    const result = await new HuntersService(repo).sample(actor, 6, () => 0.99);

    expect(repo.listPage).toHaveBeenLastCalledWith(20, 3);
    expect(result.ok && result.data.every((item) => Number(item.publicId.slice(-12)) > 40)).toBe(
      true,
    );
  });

  it("returns fewer when fewer exist, and refuses a signed-out viewer", async () => {
    const repo = repository(async () => ({ total: 2, items: hunters(1, 2) }));

    const result = await new HuntersService(repo).sample(actor, 6);

    expect(result.ok && result.data).toHaveLength(2);
    expect(await new HuntersService(repo).sample(null, 6)).toMatchObject({
      ok: false,
      code: "AUTH_REQUIRED",
    });
  });
});
