import type { MarketplaceTaxonomy } from "@/contracts/marketplace";
import { TaxonomyService, type TaxonomyReader, type TaxonomyViewer } from "./taxonomy-service";

const EMPTY: MarketplaceTaxonomy = {
  provenance: "reviewed_configuration",
  campuses: [],
  faculties: [],
  programmes: [],
  courses: [],
  academicSessions: [],
  resourceTypes: [],
  languages: [],
  tags: [],
};

const reader: TaxonomyReader = {
  listActive: vi.fn().mockResolvedValue(EMPTY),
};

function viewer(overrides: Partial<TaxonomyViewer> = {}): TaxonomyViewer {
  return { authenticated: true, emailVerified: true, institutionId: null, ...overrides };
}

describe("TaxonomyService", () => {
  test("requires a signed-in viewer", async () => {
    const result = await new TaxonomyService(reader).list(
      viewer({ authenticated: false, emailVerified: false }),
    );

    expect(result).toMatchObject({ ok: false, code: "AUTH_REQUIRED" });
  });

  test("requires email verification", async () => {
    const result = await new TaxonomyService(reader).list(viewer({ emailVerified: false }));

    expect(result).toMatchObject({ ok: false, code: "EMAIL_NOT_VERIFIED" });
  });

  test("returns an empty reviewed catalogue as a successful read", async () => {
    const result = await new TaxonomyService(reader).list(viewer());

    expect(result).toEqual({ ok: true, data: EMPTY });
  });

  test("passes the verified institution scope to the reader", async () => {
    const scopedReader: TaxonomyReader = { listActive: vi.fn().mockResolvedValue(EMPTY) };

    await new TaxonomyService(scopedReader).list(
      viewer({ institutionId: "72000000-0000-0000-0000-000000000001" }),
    );

    expect(scopedReader.listActive).toHaveBeenCalledWith("72000000-0000-0000-0000-000000000001");
  });

  test("maps a repository fault to a safe unavailable result", async () => {
    const failingReader: TaxonomyReader = {
      listActive: vi.fn().mockRejectedValue(new Error("database detail")),
    };

    const result = await new TaxonomyService(failingReader).list(viewer());

    expect(result).toEqual({
      ok: false,
      code: "MARKETPLACE_UNAVAILABLE",
      message: "The marketplace taxonomy is temporarily unavailable.",
    });
  });
});
