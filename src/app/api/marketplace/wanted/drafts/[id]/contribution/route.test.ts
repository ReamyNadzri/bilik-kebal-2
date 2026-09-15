import type { CreateContributionIntentResult } from "@/contracts/money";

const { createContributionIntent } = vi.hoisted(() => ({
  createContributionIntent:
    vi.fn<(id: string, input: unknown) => Promise<CreateContributionIntentResult>>(),
}));
vi.mock("@/modules/money/loaders/money-operations", () => ({ createContributionIntent }));
import { POST } from "./route";

describe("POST /api/marketplace/wanted/drafts/:id/contribution", () => {
  it.each([
    ["PAYMENT_DISABLED", 503],
    ["PAYMENT_UNAVAILABLE", 503],
    ["DUPLICATE_CHECK_REQUIRED", 409],
    ["AMOUNT_OUT_OF_RANGE", 422],
  ] as const)("maps %s to HTTP %s", async (code, status) => {
    createContributionIntent.mockResolvedValueOnce({ ok: false, code, message: "Safe message" });
    const response = await POST(new Request("http://local.test", { method: "POST", body: "{}" }), {
      params: Promise.resolve({ id: "draft-id" }),
    });
    expect(response.status).toBe(status);
  });

  it("uses the URL id as the trusted draft identity", async () => {
    createContributionIntent.mockResolvedValueOnce({ ok: true, data: {} as never });
    await POST(
      new Request("http://local.test", {
        method: "POST",
        body: JSON.stringify({ draftId: "spoof" }),
      }),
      { params: Promise.resolve({ id: "trusted" }) },
    );
    expect(createContributionIntent).toHaveBeenCalledWith("trusted", { draftId: "spoof" });
  });
});
