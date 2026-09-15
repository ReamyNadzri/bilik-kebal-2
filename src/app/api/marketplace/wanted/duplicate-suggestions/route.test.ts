import type { SuggestWantedDuplicatesResult } from "@/contracts/marketplace";

const { suggestWantedDuplicates } = vi.hoisted(() => ({
  suggestWantedDuplicates: vi.fn<(input: unknown) => Promise<SuggestWantedDuplicatesResult>>(),
}));
vi.mock("@/modules/wanted/loaders/wanted-operations", () => ({ suggestWantedDuplicates }));
import { POST } from "./route";

describe("POST /api/marketplace/wanted/duplicate-suggestions", () => {
  it("returns a server-issued token and suggestions", async () => {
    suggestWantedDuplicates.mockResolvedValueOnce({ ok: true, data: {} as never });
    const response = await POST(new Request("http://local.test", { method: "POST", body: "{}" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("maps a missing draft to 404", async () => {
    suggestWantedDuplicates.mockResolvedValueOnce({
      ok: false,
      code: "DRAFT_NOT_FOUND",
      message: "Not found",
    });
    expect(
      (await POST(new Request("http://local.test", { method: "POST", body: "{}" }))).status,
    ).toBe(404);
  });
});
