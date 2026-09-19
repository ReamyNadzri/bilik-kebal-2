import {
  BOARD_SORTS,
  BOARD_STATUSES,
  boardHref,
  countActiveFilters,
  parseBoardFilters,
  toListWantedQuery,
} from "./filters";
import type { BoardFilters } from "./types";

const CAMPUS = "11111111-1111-4111-8111-111111111111";
const COURSE = "44444444-4444-4444-8444-444444444444";
const RESOURCE = "66666666-6666-4666-8666-666666666666";
const SESSION = "55555555-5555-4555-8555-555555555555";

function filters(overrides: Partial<BoardFilters> = {}): BoardFilters {
  return {
    query: "",
    campusId: null,
    courseId: null,
    resourceTypeId: null,
    sessionId: null,
    status: null,
    sort: "newest",
    ...overrides,
  };
}

describe("reading the filters out of the URL", () => {
  test("carries every filter the Board offers", () => {
    expect(
      parseBoardFilters({
        q: "  past year  ",
        campus: CAMPUS,
        course: COURSE,
        resource: RESOURCE,
        session: SESSION,
        status: "reviewing",
        sort: "highest-bounty",
      }),
    ).toEqual({
      query: "past year",
      campusId: CAMPUS,
      courseId: COURSE,
      resourceTypeId: RESOURCE,
      sessionId: SESSION,
      status: "reviewing",
      sort: "highest-bounty",
    });
  });

  test("falls back to the newest order when no sort is named", () => {
    expect(parseBoardFilters({}).sort).toBe("newest");
  });

  test("drops a sort the Board does not offer", () => {
    expect(parseBoardFilters({ sort: "cheapest" }).sort).toBe("newest");
  });

  /**
   * The published contract accepts only `open` and `reviewing`. A status the
   * server cannot honour must not be sent, or the Board would answer a
   * question nobody asked.
   */
  test("drops a status the published contract does not accept", () => {
    expect(parseBoardFilters({ status: "well-funded" }).status).toBeNull();
    expect(parseBoardFilters({ status: "closed" }).status).toBeNull();
  });

  test("reads the first value when a parameter is repeated", () => {
    expect(parseBoardFilters({ q: ["one", "two"] }).query).toBe("one");
  });
});

describe("turning the URL into the published query", () => {
  test("sends nothing for an unfiltered Board but the default order", () => {
    expect(toListWantedQuery(filters())).toEqual({ sort: "newest" });
  });

  test("names each identifier the way the contract names it", () => {
    expect(
      toListWantedQuery(
        filters({
          campusId: CAMPUS,
          courseId: COURSE,
          resourceTypeId: RESOURCE,
          sessionId: SESSION,
        }),
      ),
    ).toEqual({
      sort: "newest",
      campusId: CAMPUS,
      courseId: COURSE,
      resourceTypeId: RESOURCE,
      academicSessionId: SESSION,
    });
  });

  test("sends the search text under the contract's own key", () => {
    expect(toListWantedQuery(filters({ query: "past year" }))).toMatchObject({
      query: "past year",
    });
  });

  test("omits an empty search rather than asking for everything matching nothing", () => {
    expect(toListWantedQuery(filters({ query: "" }))).not.toHaveProperty("query");
  });

  test.each([
    ["newest", "newest"],
    ["highest-bounty", "highest_bounty"],
    ["ending-soon", "ending_soon"],
  ] as const)("translates the %s URL order to the contract's %s", (url, contract) => {
    expect(toListWantedQuery(filters({ sort: url })).sort).toBe(contract);
  });

  test.each(["open", "reviewing"] as const)("passes the %s status through", (status) => {
    expect(toListWantedQuery(filters({ status })).status).toBe(status);
  });

  test("omits the status when the reader has chosen no lifecycle filter", () => {
    expect(toListWantedQuery(filters())).not.toHaveProperty("status");
  });
});

describe("what the Board offers", () => {
  test("offers exactly the three orders the contract can sort by", () => {
    expect(BOARD_SORTS.map((option) => option.id)).toEqual([
      "newest",
      "highest-bounty",
      "ending-soon",
    ]);
  });

  test("offers only the two statuses the contract accepts", () => {
    expect(BOARD_STATUSES.map((option) => option.id)).toEqual(["open", "reviewing"]);
  });
});

describe("counting and rebuilding the address", () => {
  test("counts the filters that narrow, and neither the search nor the sort", () => {
    expect(countActiveFilters(filters({ query: "notes", sort: "ending-soon" }))).toBe(0);
    expect(countActiveFilters(filters({ campusId: CAMPUS, status: "open" }))).toBe(2);
  });

  test("keeps every filter in the address so a filtered Board is linkable", () => {
    const href = boardHref(
      filters({ query: "past year", campusId: CAMPUS, status: "open", sort: "ending-soon" }),
    );

    expect(href.startsWith("/board?")).toBe(true);
    const params = new URLSearchParams(href.slice("/board?".length));
    expect(params.get("q")).toBe("past year");
    expect(params.get("campus")).toBe(CAMPUS);
    expect(params.get("status")).toBe("open");
    expect(params.get("sort")).toBe("ending-soon");
  });

  test("leaves the default order out of the address", () => {
    expect(boardHref(filters({ campusId: CAMPUS }))).toBe(`/board?campus=${CAMPUS}`);
  });

  test("addresses an unfiltered Board without a query string", () => {
    expect(boardHref(filters())).toBe("/board");
  });

  test("clearing keeps what the reader typed and drops the filters", () => {
    expect(boardHref(filters({ query: "notes", campusId: CAMPUS }), { clear: true })).toBe(
      "/board?q=notes",
    );
  });

  test("a parsed address rebuilds to the same address", () => {
    const original = `/board?q=past+year&campus=${CAMPUS}&status=reviewing&sort=ending-soon`;
    const parsed = parseBoardFilters(
      Object.fromEntries(new URLSearchParams(original.slice("/board?".length))),
    );

    expect(
      Object.fromEntries(new URLSearchParams(boardHref(parsed).slice("/board?".length))),
    ).toEqual({
      q: "past year",
      campus: CAMPUS,
      status: "reviewing",
      sort: "ending-soon",
    });
  });
});
