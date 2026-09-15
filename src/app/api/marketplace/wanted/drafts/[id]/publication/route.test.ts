import type { PrepareWantedPublicationResult } from "@/contracts/marketplace";

const { prepareWantedPublication } = vi.hoisted(() => ({
  prepareWantedPublication:
    vi.fn<(id: string, input: unknown) => Promise<PrepareWantedPublicationResult>>(),
}));
vi.mock("@/modules/wanted/loaders/wanted-operations", () => ({ prepareWantedPublication }));
import { POST } from "./route";

describe("POST /api/marketplace/wanted/drafts/:id/publication", () => {
  it.each([
    ["DUPLICATE_CHECK_REQUIRED", 409],
    ["DUPLICATE_CHECK_EXPIRED", 409],
    ["PAYMENT_DISABLED", 503],
    ["PAYMENT_UNAVAILABLE", 503],
  ] as const)("maps %s to HTTP %s", async (code, status) => {
    prepareWantedPublication.mockResolvedValueOnce({ ok: false, code, message: "Safe message" });
    const response = await POST(new Request("http://local.test", { method: "POST", body: "{}" }), {
      params: Promise.resolve({ id: "draft-id" }),
    });
    expect(response.status).toBe(status);
  });

  it("uses the URL draft id as authority", async () => {
    prepareWantedPublication.mockResolvedValueOnce({ ok: true, data: {} as never });
    await POST(
      new Request("http://local.test", {
        method: "POST",
        body: JSON.stringify({ draftId: "spoof" }),
      }),
      { params: Promise.resolve({ id: "trusted" }) },
    );
    expect(prepareWantedPublication).toHaveBeenCalledWith("trusted", { draftId: "spoof" });
  });
});
