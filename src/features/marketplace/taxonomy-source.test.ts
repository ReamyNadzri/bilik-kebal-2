import {
  coursesFor,
  loadWantedTaxonomy,
  programmesFor,
  type WantedTaxonomy,
} from "./taxonomy-source";

function ready(): WantedTaxonomy {
  const result = loadWantedTaxonomy();

  if (result.status !== "ready") {
    throw new Error(`Expected a ready taxonomy, got ${result.status}`);
  }

  return result.data;
}

describe("reading the taxonomy", () => {
  test("offers every vocabulary the creation form needs", () => {
    const taxonomy = ready();

    expect(taxonomy.campuses.length).toBeGreaterThan(0);
    expect(taxonomy.faculties.length).toBeGreaterThan(0);
    expect(taxonomy.programmes.length).toBeGreaterThan(0);
    expect(taxonomy.courses.length).toBeGreaterThan(0);
    expect(taxonomy.sessions.length).toBeGreaterThan(0);
    expect(taxonomy.resourceTypes.length).toBeGreaterThan(0);
    expect(taxonomy.languages.length).toBeGreaterThan(0);
  });

  test("says so when the taxonomy cannot be read, rather than offering nothing", () => {
    expect(loadWantedTaxonomy("unavailable")).toEqual({ status: "unavailable" });
  });

  test("can answer with a published but empty vocabulary", () => {
    const result = loadWantedTaxonomy("empty");

    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.data.campuses).toEqual([]);
      expect(result.data.courses).toEqual([]);
    }
  });

  test("is deterministic, so the same options appear on every render", () => {
    expect(loadWantedTaxonomy()).toEqual(loadWantedTaxonomy());
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

  test("offers no programme until a faculty is chosen", () => {
    expect(programmesFor(ready(), null)).toEqual([]);
  });

  test("narrows courses to the chosen programme", () => {
    const taxonomy = ready();
    const programme = taxonomy.programmes[0]!;
    const narrowed = coursesFor(taxonomy, programme.id);

    expect(narrowed.length).toBeGreaterThan(0);
    expect(narrowed.every((course) => course.programmeId === programme.id)).toBe(true);
  });

  test("offers no course until a programme is chosen", () => {
    expect(coursesFor(ready(), null)).toEqual([]);
  });

  test("offers nothing for an identifier that is not in the taxonomy", () => {
    expect(programmesFor(ready(), "not-a-faculty")).toEqual([]);
    expect(coursesFor(ready(), "not-a-programme")).toEqual([]);
  });
});

describe("what the fixture may claim", () => {
  test("labels itself as development options rather than an institutional catalogue", () => {
    expect(ready().provenance).toMatch(/not a reviewed|development/i);
  });

  test("never presents itself as the official UiTM catalogue", () => {
    expect(ready().provenance).not.toMatch(/official|authoritative|approved catalogue/i);
  });

  test("carries a course code and a name for every course", () => {
    expect(
      ready().courses.every((course) => course.code.length > 0 && course.name.length > 0),
    ).toBe(true);
  });
});
