import { describe, expect, it, vi } from "vitest";
import { TERMS_OF_USE_VERSION } from "@/contracts/legal";
import { LegalService, type LegalRepository } from "./legal-service";

const actor = { userId: "00000000-0000-4000-8000-000000000002" };
const requestId = "33333333-3333-4333-8333-333333333333";

function repository(overrides: Partial<LegalRepository> = {}): LegalRepository {
  return {
    acceptTerms: vi.fn().mockResolvedValue("accepted"),
    submitPrivacyRequest: vi.fn().mockResolvedValue(requestId),
    listOwnPrivacyRequests: vi.fn().mockResolvedValue([]),
    listPrivacyRequests: vi.fn().mockResolvedValue([]),
    answerPrivacyRequest: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const databaseError = (message: string) => Object.assign(new Error(message), { message });

describe("LegalService.acceptTerms", () => {
  it("records the current version for a signed-in member who confirms 18+", async () => {
    const repo = repository();
    const result = await new LegalService(repo).acceptTerms(actor, {
      version: TERMS_OF_USE_VERSION,
      confirmedAdult: true,
    });
    expect(result).toEqual({ ok: true, data: { outcome: "accepted" } });
    expect(repo.acceptTerms).toHaveBeenCalledWith(TERMS_OF_USE_VERSION);
  });

  it("refuses without a session or without the 18+ confirmation, before the database", async () => {
    const repo = repository();
    const service = new LegalService(repo);
    await expect(
      service.acceptTerms(null, { version: TERMS_OF_USE_VERSION, confirmedAdult: true }),
    ).resolves.toMatchObject({ code: "AUTH_REQUIRED" });
    await expect(
      service.acceptTerms(actor, { version: TERMS_OF_USE_VERSION, confirmedAdult: false }),
    ).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(
      service.acceptTerms(actor, { version: TERMS_OF_USE_VERSION }),
    ).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(repo.acceptTerms).not.toHaveBeenCalled();
  });

  it("asks for a reload when the database has a newer version", async () => {
    const service = new LegalService(
      repository({ acceptTerms: vi.fn().mockRejectedValue(databaseError("terms_version_stale")) }),
    );
    await expect(
      service.acceptTerms(actor, { version: "2026-01-01", confirmedAdult: true }),
    ).resolves.toMatchObject({ code: "TERMS_VERSION_STALE" });
  });

  it("never passes database wording to the browser", async () => {
    const service = new LegalService(
      repository({
        acceptTerms: vi.fn().mockRejectedValue(databaseError("relation does not exist")),
      }),
    );
    const result = await service.acceptTerms(actor, {
      version: TERMS_OF_USE_VERSION,
      confirmedAdult: true,
    });
    expect(result).toMatchObject({ code: "TERMS_UNAVAILABLE" });
    expect(JSON.stringify(result)).not.toContain("relation");
  });
});

describe("LegalService privacy requests", () => {
  it("sends a request with its kind and trimmed details", async () => {
    const repo = repository();
    const result = await new LegalService(repo).submitPrivacyRequest(actor, {
      kind: "correction",
      details: "  My display name is spelled wrongly.  ",
    });
    expect(result).toEqual({ ok: true, data: { id: requestId } });
    expect(repo.submitPrivacyRequest).toHaveBeenCalledWith(
      "correction",
      "My display name is spelled wrongly.",
    );
  });

  it("checks the kind and the length of the details", async () => {
    const repo = repository();
    const service = new LegalService(repo);
    await expect(
      service.submitPrivacyRequest(actor, { kind: "everything", details: "Please send my data." }),
    ).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(
      service.submitPrivacyRequest(actor, { kind: "access", details: "too short" }),
    ).resolves.toMatchObject({
      code: "VALIDATION_ERROR",
      fieldErrors: { details: [expect.any(String)] },
    });
    await expect(
      service.submitPrivacyRequest(actor, { kind: "access", details: "x".repeat(2001) }),
    ).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(repo.submitPrivacyRequest).not.toHaveBeenCalled();
  });

  it("explains the limit of three waiting requests", async () => {
    const service = new LegalService(
      repository({
        submitPrivacyRequest: vi.fn().mockRejectedValue(databaseError("privacy_request_limit")),
      }),
    );
    const result = await service.submitPrivacyRequest(actor, {
      kind: "access",
      details: "Please send me a copy of my data.",
    });
    expect(result).toMatchObject({ code: "RATE_LIMITED" });
    expect(result.ok ? "" : result.message).toContain("3 requests");
  });

  it("lists the member's own requests by their id", async () => {
    const repo = repository();
    await new LegalService(repo).listOwn(actor);
    expect(repo.listOwnPrivacyRequests).toHaveBeenCalledWith(actor.userId);
    await expect(new LegalService(repo).listOwn(null)).resolves.toMatchObject({
      code: "AUTH_REQUIRED",
    });
  });

  it("tells anyone but the Owner that the queue is the Owner's", async () => {
    const service = new LegalService(
      repository({
        listPrivacyRequests: vi
          .fn()
          .mockRejectedValue(databaseError("privacy_requests_owner_only")),
        answerPrivacyRequest: vi
          .fn()
          .mockRejectedValue(databaseError("privacy_requests_owner_only")),
      }),
    );
    await expect(service.listForOwner(actor)).resolves.toMatchObject({ code: "NOT_AUTHORIZED" });
    await expect(service.answer(actor, requestId, { answer: "Done." })).resolves.toMatchObject({
      code: "NOT_AUTHORIZED",
    });
  });

  it("answers an open request once, and refuses a bad id or an empty answer early", async () => {
    const repo = repository();
    const service = new LegalService(repo);
    await expect(service.answer(actor, requestId, { answer: " Sent below. " })).resolves.toEqual({
      ok: true,
      data: { done: true },
    });
    expect(repo.answerPrivacyRequest).toHaveBeenCalledWith(requestId, "Sent below.");
    await expect(service.answer(actor, "not-a-uuid", { answer: "Done." })).resolves.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(service.answer(actor, requestId, { answer: "   " })).resolves.toMatchObject({
      code: "VALIDATION_ERROR",
    });

    const answered = new LegalService(
      repository({
        answerPrivacyRequest: vi.fn().mockRejectedValue(databaseError("privacy_request_not_open")),
      }),
    );
    await expect(answered.answer(actor, requestId, { answer: "Again." })).resolves.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
