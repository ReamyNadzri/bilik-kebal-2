import {
  checkWantedDuplicates,
  requestWantedPublication,
  saveWantedDraft,
} from "./draft-operations";
import type { WantedDraftInput } from "@/contracts/marketplace";

const DRAFT_ID = "6d0f2b1a-7a6f-4a2a-9f3c-6e6f2e0f5a11";

function input(): WantedDraftInput {
  return {
    campusId: "11111111-1111-4111-8111-111111111111",
    facultyId: "22222222-2222-4222-8222-222222222222",
    programmeId: "33333333-3333-4333-8333-333333333333",
    courseId: "44444444-4444-4444-8444-444444444444",
    academicSessionId: "55555555-5555-4555-8555-555555555555",
    resourceTypeId: "66666666-6666-4666-8666-666666666666",
    languageId: "77777777-7777-4777-8777-777777777777",
    tagIds: [],
    title: "Final exam notes for the whole syllabus",
    description: "Complete notes covering every chapter, with diagrams and worked examples.",
    durationDays: 14,
    policyAccepted: true,
  };
}

function respond(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: async () => body,
  });
}

function lastCall(fetchMock: ReturnType<typeof vi.fn>) {
  const [path, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];

  return { path, init, body: JSON.parse(String(init.body)) as Record<string, unknown> };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("saving a draft", () => {
  test("creates a new draft with POST when none exists yet", async () => {
    const fetchMock = respond({ ok: true, data: { id: DRAFT_ID, state: "draft" } }, 201);
    vi.stubGlobal("fetch", fetchMock);

    const result = await saveWantedDraft(input(), null);

    const { path, init, body } = lastCall(fetchMock);
    expect(path).toBe("/api/marketplace/wanted/drafts");
    expect(init.method).toBe("POST");
    expect(body).toMatchObject({ title: "Final exam notes for the whole syllabus" });
    expect(result.ok).toBe(true);
  });

  test("updates an existing draft with PUT at its own address", async () => {
    const fetchMock = respond({ ok: true, data: { id: DRAFT_ID, state: "draft" } });
    vi.stubGlobal("fetch", fetchMock);

    await saveWantedDraft(input(), DRAFT_ID);

    const { path, init } = lastCall(fetchMock);
    expect(path).toBe(`/api/marketplace/wanted/drafts/${DRAFT_ID}`);
    expect(init.method).toBe("PUT");
  });

  test("never sends an identity the server derives from the session", async () => {
    const fetchMock = respond({ ok: true, data: { id: DRAFT_ID, state: "draft" } }, 201);
    vi.stubGlobal("fetch", fetchMock);

    await saveWantedDraft(input(), null);

    const { body } = lastCall(fetchMock);
    expect(body).not.toHaveProperty("commissionerUserId");
    expect(body).not.toHaveProperty("institutionId");
    expect(body).not.toHaveProperty("draftId");
  });

  test("escapes a draft identifier rather than pasting it into the path", async () => {
    const fetchMock = respond({ ok: true, data: { id: DRAFT_ID, state: "draft" } });
    vi.stubGlobal("fetch", fetchMock);

    await saveWantedDraft(input(), "../../admin");

    expect(lastCall(fetchMock).path).toBe("/api/marketplace/wanted/drafts/..%2F..%2Fadmin");
  });

  test("reports a refusal in the shape a screen already handles", async () => {
    vi.stubGlobal(
      "fetch",
      respond(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          message: "Check it",
          fieldErrors: { title: ["No"] },
        },
        422,
      ),
    );

    const result = await saveWantedDraft(input(), null);

    expect(result).toEqual({
      ok: false,
      code: "VALIDATION_ERROR",
      message: "Check it",
      fieldErrors: { title: ["No"] },
    });
  });

  test("reports an unreachable server as a marketplace failure, not a crash", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const result = await saveWantedDraft(input(), null);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.code).toBe("MARKETPLACE_UNAVAILABLE");
  });
});

describe("checking for similar requests", () => {
  test("asks about one draft by its identifier", async () => {
    const fetchMock = respond({
      ok: true,
      data: { token: "t.0", expiresAt: "2026-09-15T00:15:00.000Z", suggestions: [] },
    });
    vi.stubGlobal("fetch", fetchMock);

    await checkWantedDuplicates(DRAFT_ID);

    const { path, init, body } = lastCall(fetchMock);
    expect(path).toBe("/api/marketplace/wanted/duplicate-suggestions");
    expect(init.method).toBe("POST");
    expect(body).toEqual({ draftId: DRAFT_ID });
  });
});

describe("asking to publish", () => {
  test("sends the opaque token and integer sen to the draft's publication address", async () => {
    const fetchMock = respond(
      { ok: false, code: "PAYMENT_DISABLED", message: "Payments are currently disabled." },
      503,
    );
    vi.stubGlobal("fetch", fetchMock);

    await requestWantedPublication(DRAFT_ID, "nonce.signature", 1250);

    const { path, init, body } = lastCall(fetchMock);
    expect(path).toBe(`/api/marketplace/wanted/drafts/${DRAFT_ID}/publication`);
    expect(init.method).toBe("POST");
    expect(body).toEqual({ duplicateCheckToken: "nonce.signature", initialContributionSen: 1250 });
  });

  test("lets the route identify the draft rather than trusting a browser field", async () => {
    const fetchMock = respond({ ok: false, code: "PAYMENT_DISABLED", message: "off" }, 503);
    vi.stubGlobal("fetch", fetchMock);

    await requestWantedPublication(DRAFT_ID, "nonce.signature", 1250);

    expect(lastCall(fetchMock).body).not.toHaveProperty("draftId");
  });

  test("passes a payment refusal through unchanged", async () => {
    vi.stubGlobal(
      "fetch",
      respond({ ok: false, code: "PAYMENT_DISABLED", message: "Payments are disabled." }, 503),
    );

    const result = await requestWantedPublication(DRAFT_ID, "nonce.signature", 1250);

    expect(result).toEqual({
      ok: false,
      code: "PAYMENT_DISABLED",
      message: "Payments are disabled.",
    });
  });
});
