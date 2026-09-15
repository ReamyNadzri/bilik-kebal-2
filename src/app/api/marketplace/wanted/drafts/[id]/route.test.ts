import type { UpdateWantedDraftResult } from "@/contracts/marketplace";

const { updateWantedDraft } = vi.hoisted(() => ({
  updateWantedDraft: vi.fn<(id: string, input: unknown) => Promise<UpdateWantedDraftResult>>(),
}));
vi.mock("@/modules/wanted/loaders/wanted-operations", () => ({ updateWantedDraft }));

import { PUT } from "./route";

describe("PUT /api/marketplace/wanted/drafts/:id", () => {
  it.each([
    ["NOT_AUTHORIZED", 403],
    ["DRAFT_NOT_FOUND", 404],
    ["DRAFT_NOT_EDITABLE", 409],
    ["VALIDATION_ERROR", 422],
  ] as const)("maps %s to HTTP %s", async (code, status) => {
    updateWantedDraft.mockResolvedValueOnce({ ok: false, code, message: "Safe message" });
    const response = await PUT(new Request("http://local.test", { method: "PUT", body: "{}" }), {
      params: Promise.resolve({ id: "draft-id" }),
    });
    expect(response.status).toBe(status);
  });

  it("passes the route id separately from caller JSON", async () => {
    updateWantedDraft.mockResolvedValueOnce({ ok: true, data: {} as never });
    const response = await PUT(
      new Request("http://local.test", {
        method: "PUT",
        body: JSON.stringify({ draftId: "spoof" }),
      }),
      { params: Promise.resolve({ id: "trusted-id" }) },
    );
    expect(response.status).toBe(200);
    expect(updateWantedDraft).toHaveBeenCalledWith("trusted-id", { draftId: "spoof" });
  });
});
