import { describe, expect, it, vi } from "vitest";
import type { ConsoleRepository } from "../repositories/supabase-console-repository";
import { ConsoleService } from "./console-service";

const actor = { userId: "00000000-0000-4000-8000-000000000001" };
const member = "11111111-1111-4111-8111-111111111111";

function repository(overrides: Partial<ConsoleRepository> = {}): ConsoleRepository {
  return {
    myRole: vi.fn().mockResolvedValue("owner"),
    searchMembers: vi.fn().mockResolvedValue([]),
    act: vi.fn().mockResolvedValue(undefined),
    listHiddenReplies: vi.fn().mockResolvedValue([]),
    restoreReply: vi.fn().mockResolvedValue(undefined),
    listBadges: vi.fn().mockResolvedValue([]),
    createBadge: vi.fn().mockResolvedValue("badge-1"),
    retireBadge: vi.fn().mockResolvedValue(undefined),
    createBadgeUpload: vi.fn().mockResolvedValue({ signedUrl: "https://u", token: "t" }),
    ...overrides,
  };
}

describe("ConsoleService", () => {
  it("requires a signed-in caller for everything", async () => {
    const service = new ConsoleService(repository());
    expect(await service.search(null, "x")).toMatchObject({ ok: false, code: "AUTH_REQUIRED" });
    expect(await service.act(null, member, { action: "lift" })).toMatchObject({
      code: "AUTH_REQUIRED",
    });
  });

  it("passes a valid timeout through", async () => {
    const repo = repository();
    const result = await new ConsoleService(repo).act(actor, member, {
      action: "timeout",
      hours: 24,
      reasonCode: "spam",
    });
    expect(result).toEqual({ ok: true, data: { done: true } });
    expect(repo.act).toHaveBeenCalledWith(member, {
      action: "timeout",
      hours: 24,
      reasonCode: "spam",
    });
  });

  it("refuses durations and reason codes the database would refuse, without calling it", async () => {
    const repo = repository();
    const service = new ConsoleService(repo);
    expect(
      await service.act(actor, member, { action: "timeout", hours: 5, reasonCode: "spam" }),
    ).toMatchObject({ code: "VALIDATION_ERROR" });
    expect(
      await service.act(actor, member, { action: "restrict", reasonCode: "Bad Reason" }),
    ).toMatchObject({ code: "VALIDATION_ERROR" });
    expect(repo.act).not.toHaveBeenCalled();
  });

  it("maps the step-up, role and double-restriction refusals", async () => {
    for (const [message, code] of [
      ["RECENT_AUTH_REQUIRED", "RECENT_AUTH_REQUIRED"],
      ["NOT_AUTHORIZED", "NOT_AUTHORIZED"],
      ["ACCOUNT_ALREADY_RESTRICTED", "ALREADY_RESTRICTED"],
      ["something else", "CONSOLE_UNAVAILABLE"],
    ] as const) {
      const service = new ConsoleService(
        repository({ act: vi.fn().mockRejectedValue({ message }) }),
      );
      expect(await service.act(actor, member, { action: "lift" })).toMatchObject({
        ok: false,
        code,
      });
    }
  });

  it("prepares a badge upload only for the Owner, under a generated key", async () => {
    const owner = repository();
    const result = await new ConsoleService(owner).badgeUpload(actor, {
      contentType: "image/png",
    });
    expect(result).toMatchObject({ ok: true, data: { imageKey: expect.stringMatching(/\.png$/) } });

    const sheriff = new ConsoleService(
      repository({ myRole: vi.fn().mockResolvedValue("platform_sheriff") }),
    );
    expect(await sheriff.badgeUpload(actor, { contentType: "image/png" })).toMatchObject({
      code: "NOT_AUTHORIZED",
    });
    expect(
      await new ConsoleService(owner).badgeUpload(actor, { contentType: "image/gif" }),
    ).toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
