import { describe, expect, it, vi } from "vitest";
import type { WantedActor } from "../domain/wanted-policy";
import { WantedPosterService, type WantedPosterRepository } from "./wanted-poster-service";

const actor: WantedActor = {
  userId: "00000000-0000-4000-8000-000000000002",
  emailVerified: true,
  institutionId: "00000000-0000-4000-8000-000000000003",
  institutionVerified: true,
  restricted: false,
};
const publicId = "11111111-1111-4111-8111-111111111111";
const edit = {
  title: "Past year papers for MAT183",
  description: "Any past year final papers from 2022 onwards, with or without answers.",
};

function repository(overrides: Partial<WantedPosterRepository> = {}): WantedPosterRepository {
  return {
    readChangeWindow: vi
      .fn()
      .mockResolvedValue({ editableUntil: "2026-09-28T11:00:00.000Z", lockedReason: null }),
    updatePublishedWanted: vi.fn().mockResolvedValue(undefined),
    withdrawWanted: vi.fn().mockResolvedValue(2),
    ...overrides,
  };
}

describe("WantedPosterService", () => {
  it("reads the poster's window", async () => {
    const result = await new WantedPosterService(repository()).changeWindow(actor, publicId);
    expect(result).toEqual({
      ok: true,
      data: { editableUntil: "2026-09-28T11:00:00.000Z", lockedReason: null },
    });
  });

  it("answers not found to anyone who is not the poster", async () => {
    const repo = repository({ readChangeWindow: vi.fn().mockResolvedValue(null) });
    const result = await new WantedPosterService(repo).changeWindow(actor, publicId);
    expect(result).toMatchObject({ ok: false, code: "WANTED_NOT_FOUND" });
  });

  it("saves trimmed text", async () => {
    const repo = repository();
    const result = await new WantedPosterService(repo).edit(actor, publicId, {
      title: `  ${edit.title} `,
      description: edit.description,
    });
    expect(result).toEqual({ ok: true, data: { state: "edited" } });
    expect(repo.updatePublishedWanted).toHaveBeenCalledWith(publicId, edit.title, edit.description);
  });

  it("refuses text outside the published limits without calling the database", async () => {
    const repo = repository();
    const result = await new WantedPosterService(repo).edit(actor, publicId, {
      title: "Short",
      description: edit.description,
    });
    expect(result).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    expect(repo.updatePublishedWanted).not.toHaveBeenCalled();
  });

  it.each([
    ["window_closed", /hour for changes has passed/],
    ["claim_submitted", /submitted a claim/],
    ["reply_received", /Someone has replied/],
    ["not_open", /Only an open Wanted/],
  ])("maps the %s lock to WANTED_LOCKED", async (reason, message) => {
    const repo = repository({
      updatePublishedWanted: vi
        .fn()
        .mockRejectedValue({ message: `wanted_change_locked:${reason}` }),
    });
    const result = await new WantedPosterService(repo).edit(actor, publicId, edit);
    expect(result).toMatchObject({ ok: false, code: "WANTED_LOCKED" });
    expect(result.ok ? "" : result.message).toMatch(message);
  });

  it("withdraws and reports the refunds queued", async () => {
    const result = await new WantedPosterService(repository()).withdraw(actor, publicId);
    expect(result).toEqual({ ok: true, data: { state: "withdrawn", refundsQueued: 2 } });
  });

  it("maps a locked withdrawal", async () => {
    const repo = repository({
      withdrawWanted: vi
        .fn()
        .mockRejectedValue({ message: "wanted_change_locked:claim_submitted" }),
    });
    const result = await new WantedPosterService(repo).withdraw(actor, publicId);
    expect(result).toMatchObject({ ok: false, code: "WANTED_LOCKED" });
  });

  it("maps someone else's Wanted to not found", async () => {
    const repo = repository({
      withdrawWanted: vi.fn().mockRejectedValue({ message: "wanted_not_found" }),
    });
    const result = await new WantedPosterService(repo).withdraw(actor, publicId);
    expect(result).toMatchObject({ ok: false, code: "WANTED_NOT_FOUND" });
  });

  it("does not leak database errors", async () => {
    const repo = repository({
      withdrawWanted: vi.fn().mockRejectedValue({ message: "connection reset by peer" }),
    });
    const result = await new WantedPosterService(repo).withdraw(actor, publicId);
    expect(result).toEqual({
      ok: false,
      code: "MARKETPLACE_UNAVAILABLE",
      message: "This Wanted could not be withdrawn. Try again.",
    });
  });

  it("requires a signed-in, unrestricted poster and a well-formed id", async () => {
    const repo = repository();
    const service = new WantedPosterService(repo);
    expect(await service.withdraw(null, publicId)).toMatchObject({ code: "AUTH_REQUIRED" });
    expect(await service.withdraw({ ...actor, restricted: true }, publicId)).toMatchObject({
      code: "ACCOUNT_RESTRICTED",
    });
    expect(await service.edit(actor, "not-a-uuid", edit)).toMatchObject({
      code: "WANTED_NOT_FOUND",
    });
    expect(repo.withdrawWanted).not.toHaveBeenCalled();
    expect(repo.updatePublishedWanted).not.toHaveBeenCalled();
  });
});
