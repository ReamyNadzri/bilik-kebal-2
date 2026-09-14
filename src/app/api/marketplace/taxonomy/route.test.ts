import type { ListTaxonomyResult } from "@/contracts/marketplace";

const { loadMarketplaceTaxonomy } = vi.hoisted(() => ({
  loadMarketplaceTaxonomy: vi.fn<() => Promise<ListTaxonomyResult>>(),
}));

vi.mock("@/modules/taxonomy/loaders/taxonomy-read", () => ({
  loadMarketplaceTaxonomy,
}));

import { GET } from "./route";

describe("GET /api/marketplace/taxonomy", () => {
  test.each([
    ["AUTH_REQUIRED", 401],
    ["EMAIL_NOT_VERIFIED", 403],
    ["MARKETPLACE_UNAVAILABLE", 503],
  ] as const)("maps %s to HTTP %s", async (code, status) => {
    loadMarketplaceTaxonomy.mockResolvedValueOnce({ ok: false, code, message: "Safe message" });

    const response = await GET();

    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ ok: false, code });
  });

  test("returns an empty catalogue as success rather than unavailable", async () => {
    loadMarketplaceTaxonomy.mockResolvedValueOnce({
      ok: true,
      data: {
        provenance: "reviewed_configuration",
        campuses: [],
        faculties: [],
        programmes: [],
        courses: [],
        academicSessions: [],
        resourceTypes: [],
        languages: [],
        tags: [],
      },
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
