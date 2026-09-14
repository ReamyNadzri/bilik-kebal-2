import { applyBoardFilters, boardHref, countActiveFilters, parseBoardFilters } from "./filters";
import { WANTED } from "./fixtures";
import { aWanted } from "./test-support/wanted";

const NOW = "2026-09-14T09:00:00.000Z";

describe("reading filters from the URL", () => {
  test("defaults to an unfiltered Board sorted newest first", () => {
    expect(parseBoardFilters({})).toEqual({
      query: "",
      campusId: null,
      courseId: null,
      resourceTypeId: null,
      sessionId: null,
      status: null,
      sort: "newest",
    });
  });

  test("reads every filter the Board offers", () => {
    expect(
      parseBoardFilters({
        q: "calculus",
        campus: "shah-alam",
        course: "csc510",
        resource: "lecture-notes",
        session: "2024-2025-sem2",
        status: "open",
        sort: "highest-bounty",
      }),
    ).toEqual({
      query: "calculus",
      campusId: "shah-alam",
      courseId: "csc510",
      resourceTypeId: "lecture-notes",
      sessionId: "2024-2025-sem2",
      status: "open",
      sort: "highest-bounty",
    });
  });

  test("trims a padded query rather than searching for whitespace", () => {
    expect(parseBoardFilters({ q: "  calculus  " }).query).toBe("calculus");
  });

  test("ignores a taxonomy value that is not on the Board", () => {
    expect(parseBoardFilters({ campus: "oxford" }).campusId).toBeNull();
    expect(parseBoardFilters({ course: "not-a-course" }).courseId).toBeNull();
    expect(parseBoardFilters({ resource: "mp3" }).resourceTypeId).toBeNull();
    expect(parseBoardFilters({ session: "1999" }).sessionId).toBeNull();
  });

  test("ignores a lifecycle state that is not one of ours", () => {
    expect(parseBoardFilters({ status: "deleted" }).status).toBeNull();
  });

  test("falls back to the default sort rather than failing on a bad one", () => {
    expect(parseBoardFilters({ sort: "cheapest" }).sort).toBe("newest");
  });

  test("takes the first value when a parameter is repeated", () => {
    expect(parseBoardFilters({ campus: ["shah-alam", "arau"] }).campusId).toBe("shah-alam");
  });
});

describe("counting what is applied", () => {
  test("counts nothing on a fresh Board", () => {
    expect(countActiveFilters(parseBoardFilters({}))).toBe(0);
  });

  test("counts each applied filter", () => {
    expect(countActiveFilters(parseBoardFilters({ campus: "arau", status: "open" }))).toBe(2);
  });

  test("does not count the search text, which is always visible on its own", () => {
    expect(countActiveFilters(parseBoardFilters({ q: "calculus" }))).toBe(0);
  });

  test("does not count the sort order, which is never a filter", () => {
    expect(countActiveFilters(parseBoardFilters({ sort: "ending-soon" }))).toBe(0);
  });
});

describe("building a Board address", () => {
  test("addresses a plain Board with no query string", () => {
    expect(boardHref(parseBoardFilters({}))).toBe("/board");
  });

  test("carries the applied filters so the view can be linked and shared", () => {
    const href = boardHref(parseBoardFilters({ q: "notes", campus: "arau", sort: "ending-soon" }));

    expect(href).toContain("q=notes");
    expect(href).toContain("campus=arau");
    expect(href).toContain("sort=ending-soon");
  });

  test("keeps the search text when clearing the filters", () => {
    const href = boardHref(parseBoardFilters({ q: "notes", campus: "arau" }), { clear: true });

    expect(href).toBe("/board?q=notes");
  });

  test("drops everything when clearing an unsearched Board", () => {
    expect(boardHref(parseBoardFilters({ campus: "arau" }), { clear: true })).toBe("/board");
  });

  test("encodes a query safely", () => {
    expect(boardHref(parseBoardFilters({ q: "past year & answers" }))).toBe(
      "/board?q=past+year+%26+answers",
    );
  });
});

describe("selecting Wanteds", () => {
  test("returns everything when nothing is applied", () => {
    expect(applyBoardFilters(WANTED, parseBoardFilters({}), NOW)).toHaveLength(WANTED.length);
  });

  test("matches a course code regardless of case", () => {
    const found = applyBoardFilters(WANTED, parseBoardFilters({ q: "csc510" }), NOW);

    expect(found.length).toBeGreaterThan(0);
    expect(found.every((wanted) => wanted.courseCode === "CSC510")).toBe(true);
  });

  test("matches words in the request title", () => {
    const found = applyBoardFilters(WANTED, parseBoardFilters({ q: "formula sheet" }), NOW);

    expect(found.map((wanted) => wanted.id)).toEqual(["eco415-formula-sheet"]);
  });

  test("matches a campus by name so a reader can search the way they speak", () => {
    const found = applyBoardFilters(WANTED, parseBoardFilters({ q: "segamat" }), NOW);

    expect(found.every((wanted) => wanted.campus.includes("Segamat"))).toBe(true);
    expect(found.length).toBeGreaterThan(0);
  });

  test("finds nothing for a query that matches nothing", () => {
    expect(applyBoardFilters(WANTED, parseBoardFilters({ q: "zzzz" }), NOW)).toEqual([]);
  });

  test("narrows to one campus", () => {
    const found = applyBoardFilters(WANTED, parseBoardFilters({ campus: "arau" }), NOW);

    expect(found.length).toBeGreaterThan(0);
    expect(found.every((wanted) => wanted.campusId === "arau")).toBe(true);
  });

  test("narrows to one resource type", () => {
    const found = applyBoardFilters(
      WANTED,
      parseBoardFilters({ resource: "past-year-answers" }),
      NOW,
    );

    expect(found.every((wanted) => wanted.resourceTypeId === "past-year-answers")).toBe(true);
  });

  test("narrows to one lifecycle state", () => {
    const found = applyBoardFilters(WANTED, parseBoardFilters({ status: "closed" }), NOW);

    expect(found.every((wanted) => wanted.status === "closed")).toBe(true);
  });

  test("applies filters together rather than as alternatives", () => {
    const found = applyBoardFilters(
      WANTED,
      parseBoardFilters({ campus: "shah-alam", resource: "revision-set" }),
      NOW,
    );

    expect(
      found.every((w) => w.campusId === "shah-alam" && w.resourceTypeId === "revision-set"),
    ).toBe(true);
  });
});

describe("sorting", () => {
  const items = [
    aWanted({
      id: "a",
      grossBountySen: 1000 as never,
      postedAt: "2026-09-01T00:00:00.000Z",
      closesAt: "2026-09-30T00:00:00.000Z",
    }),
    aWanted({
      id: "b",
      grossBountySen: 5000 as never,
      postedAt: "2026-09-12T00:00:00.000Z",
      closesAt: "2026-09-16T00:00:00.000Z",
    }),
    aWanted({
      id: "c",
      grossBountySen: 3000 as never,
      postedAt: "2026-09-05T00:00:00.000Z",
      closesAt: "2026-09-15T00:00:00.000Z",
    }),
  ];

  test("newest first puts the most recently posted at the top", () => {
    const sorted = applyBoardFilters(items, parseBoardFilters({ sort: "newest" }), NOW);

    expect(sorted.map((w) => w.id)).toEqual(["b", "c", "a"]);
  });

  test("highest bounty first ranks by money, not by time", () => {
    const sorted = applyBoardFilters(items, parseBoardFilters({ sort: "highest-bounty" }), NOW);

    expect(sorted.map((w) => w.id)).toEqual(["b", "c", "a"]);
  });

  test("ending soon ranks by the nearest deadline", () => {
    const sorted = applyBoardFilters(items, parseBoardFilters({ sort: "ending-soon" }), NOW);

    expect(sorted.map((w) => w.id)).toEqual(["c", "b", "a"]);
  });

  test("ending soon sends already-closed requests to the end, not the front", () => {
    const withClosed = [
      ...items,
      aWanted({ id: "gone", status: "closed", closesAt: "2026-09-01T00:00:00.000Z" }),
    ];
    const sorted = applyBoardFilters(withClosed, parseBoardFilters({ sort: "ending-soon" }), NOW);

    expect(sorted[sorted.length - 1]?.id).toBe("gone");
  });

  test("does not mutate the Wanteds it was given", () => {
    const original = items.map((w) => w.id);

    applyBoardFilters(items, parseBoardFilters({ sort: "highest-bounty" }), NOW);

    expect(items.map((w) => w.id)).toEqual(original);
  });
});
