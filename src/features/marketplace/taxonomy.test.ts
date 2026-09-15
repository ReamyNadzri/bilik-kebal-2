import { courseLabel, coursesFor, programmesFor } from "./taxonomy";
import { aTaxonomy, TAXONOMY_ID } from "./test-support/taxonomy";

describe("narrowing the hierarchy the server enforces", () => {
  test("offers only the programmes belonging to the chosen faculty", () => {
    const narrowed = programmesFor(aTaxonomy(), TAXONOMY_ID.faculty);

    expect(narrowed.map((programme) => programme.id)).toEqual([TAXONOMY_ID.programme]);
  });

  test("offers no programme until a faculty is chosen", () => {
    expect(programmesFor(aTaxonomy(), null)).toEqual([]);
    expect(programmesFor(aTaxonomy(), "")).toEqual([]);
  });

  test("offers only the courses belonging to the chosen programme", () => {
    const narrowed = coursesFor(aTaxonomy(), TAXONOMY_ID.programme);

    expect(narrowed.map((course) => course.id)).toEqual([TAXONOMY_ID.course]);
  });

  test("offers no course until a programme is chosen", () => {
    expect(coursesFor(aTaxonomy(), null)).toEqual([]);
    expect(coursesFor(aTaxonomy(), "")).toEqual([]);
  });

  test("offers nothing for an identifier the taxonomy does not contain", () => {
    expect(programmesFor(aTaxonomy(), "00000000-0000-4000-8000-000000000000")).toEqual([]);
    expect(coursesFor(aTaxonomy(), "00000000-0000-4000-8000-000000000000")).toEqual([]);
  });
});

describe("naming a course", () => {
  test("reads as the code a student searches for, then its name", () => {
    expect(courseLabel(aTaxonomy().courses[0]!)).toBe("CSC510 Database Systems");
  });
});
