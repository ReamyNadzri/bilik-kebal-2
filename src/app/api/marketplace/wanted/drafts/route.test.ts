import type { CreateWantedDraftResult } from "@/contracts/marketplace";

const { createWantedDraft } = vi.hoisted(() => ({
  createWantedDraft: vi.fn<(input: unknown) => Promise<CreateWantedDraftResult>>(),
}));
vi.mock("@/modules/wanted/loaders/wanted-operations", () => ({ createWantedDraft }));

import { POST } from "./route";

describe("POST /api/marketplace/wanted/drafts", () => {
  it.each([
    ["AUTH_REQUIRED", 401],
    ["INSTITUTION_VERIFICATION_REQUIRED", 403],
    ["VALIDATION_ERROR", 422],
    ["MARKETPLACE_UNAVAILABLE", 503],
  ] as const)("maps %s to HTTP %s", async (code, status) => {
    createWantedDraft.mockResolvedValueOnce({ ok: false, code, message: "Safe message" });
    const response = await POST(new Request("http://local.test", { method: "POST", body: "{}" }));
    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ ok: false, code });
  });

  it("returns a created draft with private no-store caching", async () => {
    createWantedDraft.mockResolvedValueOnce({ ok: true, data: {} as never });
    const response = await POST(new Request("http://local.test", { method: "POST", body: "{}" }));
    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
