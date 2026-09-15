import { loadPreviewTaxonomy } from "./preview-taxonomy";
import { coursesFor, programmesFor } from "./taxonomy";
import type { MarketplaceTaxonomy } from "@/contracts/marketplace";

function ready(): MarketplaceTaxonomy {
  const result = loadPreviewTaxonomy();

  if (result.status !== "ready") {
    throw new Error(`Expected a ready taxonomy, got ${result.status}`);
  }

  return result.data;
}

describe("reading the harness taxonomy", () => {
  test("offers every vocabulary the creation form needs", () => {
    const taxonomy = ready();

    expect(taxonomy.campuses.length).toBeGreaterThan(0);
    expect(taxonomy.faculties.length).toBeGreaterThan(0);
    expect(taxonomy.programmes.length).toBeGreaterThan(0);
    expect(taxonomy.courses.length).toBeGreaterThan(0);
    expect(taxonomy.academicSessions.length).toBeGreaterThan(0);
    expect(taxonomy.resourceTypes.length).toBeGreaterThan(0);
    expect(taxonomy.languages.length).toBeGreaterThan(0);
    expect(taxonomy.tags.length).toBeGreaterThan(5);
  });

  test("says so when the taxonomy cannot be read, rather than offering nothing", () => {
    expect(loadPreviewTaxonomy("unavailable")).toEqual({ status: "unavailable" });
  });

  test("can answer with a published but empty vocabulary", () => {
    const result = loadPreviewTaxonomy("empty");

    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.data.campuses).toEqual([]);
      expect(result.data.courses).toEqual([]);
    }
  });

  test("is deterministic, so the same options appear on every render", () => {
    expect(loadPreviewTaxonomy()).toEqual(loadPreviewTaxonomy());
  });
});

describe("the hierarchy the backend enforces", () => {
  test("hangs every programme from a faculty that exists", () => {
    const taxonomy = ready();
    const facultyIds = new Set(taxonomy.faculties.map((faculty) => faculty.id));

    expect(taxonomy.programmes.every((programme) => facultyIds.has(programme.facultyId))).toBe(
      true,
    );
  });

  test("hangs every course from a programme that exists", () => {
    const taxonomy = ready();
    const programmeIds = new Set(taxonomy.programmes.map((programme) => programme.id));

    expect(taxonomy.courses.every((course) => programmeIds.has(course.programmeId))).toBe(true);
  });

  test("narrows programmes to the chosen faculty", () => {
    const taxonomy = ready();
    const faculty = taxonomy.faculties[0]!;
    const narrowed = programmesFor(taxonomy, faculty.id);

    expect(narrowed.length).toBeGreaterThan(0);
    expect(narrowed.every((programme) => programme.facultyId === faculty.id)).toBe(true);
  });

  test("narrows courses to the chosen programme", () => {
    const taxonomy = ready();
    const programme = taxonomy.programmes[0]!;
    const narrowed = coursesFor(taxonomy, programme.id);

    expect(narrowed.length).toBeGreaterThan(0);
    expect(narrowed.every((course) => course.programmeId === programme.id)).toBe(true);
  });
});

describe("what the harness options must be shaped like", () => {
  test("identifies every option with a UUID, because the contract accepts nothing else", () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    const taxonomy = ready();

    for (const group of [
      taxonomy.campuses,
      taxonomy.faculties,
      taxonomy.programmes,
      taxonomy.courses,
      taxonomy.academicSessions,
      taxonomy.resourceTypes,
      taxonomy.languages,
      taxonomy.tags,
    ]) {
      expect(group.every((option) => uuid.test(option.id))).toBe(true);
    }
  });

  test("gives every option a distinct identifier", () => {
    const taxonomy = ready();
    const ids = [
      ...taxonomy.campuses,
      ...taxonomy.faculties,
      ...taxonomy.programmes,
      ...taxonomy.courses,
      ...taxonomy.academicSessions,
      ...taxonomy.resourceTypes,
      ...taxonomy.languages,
      ...taxonomy.tags,
    ].map((option) => option.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  test("carries a course code and a label for every course", () => {
    expect(
      ready().courses.every((course) => course.code.length > 0 && course.label.length > 0),
    ).toBe(true);
  });
});
