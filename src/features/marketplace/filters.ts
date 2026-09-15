import { CAMPUSES, COURSES, RESOURCE_TYPES, SESSIONS } from "./fixtures";
import type { BoardFilters, BoardSort, TaxonomyOption, WantedStatus, WantedSummary } from "./types";

/**
 * Board filter state, carried in the URL.
 *
 * Every control on the Board is a plain `GET` field, so a filtered Board is
 * linkable, survives the back button and works before JavaScript loads. This
 * follows the structure settled in
 * `docs/superpowers/specs/2026-09-14-vaultix-identity-screen-design.md` §10.3.
 *
 * `applyBoardFilters` is a fixture-side stand-in for work the Board read will
 * do on the server. Parsing and address-building stay here when that arrives;
 * the selection does not.
 */

export const BOARD_SORTS: readonly { readonly id: BoardSort; readonly label: string }[] = [
  { id: "newest", label: "Newest first" },
  { id: "highest-bounty", label: "Highest bounty" },
  { id: "ending-soon", label: "Ending soonest" },
] as const;

export const BOARD_STATUSES: readonly { readonly id: WantedStatus; readonly label: string }[] = [
  { id: "open", label: "Open" },
  { id: "ending-soon", label: "Ending soon" },
  { id: "well-funded", label: "Well funded" },
  { id: "reviewing", label: "Under review" },
  { id: "closed", label: "Closed" },
] as const;

type RawParams = Record<string, string | readonly string[] | undefined>;

function first(raw: string | readonly string[] | undefined): string | undefined {
  return Array.isArray(raw) ? raw[0] : (raw as string | undefined);
}

/**
 * An unknown value is dropped rather than passed through.
 *
 * A hand-edited URL must not be able to put the Board into a state its own
 * controls cannot show or clear.
 */
function known(
  raw: string | readonly string[] | undefined,
  options: readonly TaxonomyOption[],
): string | null {
  const value = first(raw);

  return value !== undefined && options.some((option) => option.id === value) ? value : null;
}

export function parseBoardFilters(params: RawParams): BoardFilters {
  const status = first(params["status"]);
  const sort = first(params["sort"]);

  return {
    query: (first(params["q"]) ?? "").trim(),
    campusId: known(params["campus"], CAMPUSES),
    courseId: known(params["course"], COURSES),
    resourceTypeId: known(params["resource"], RESOURCE_TYPES),
    sessionId: known(params["session"], SESSIONS),
    status: BOARD_STATUSES.some((option) => option.id === status) ? (status as WantedStatus) : null,
    sort: BOARD_SORTS.some((option) => option.id === sort) ? (sort as BoardSort) : "newest",
  };
}

/**
 * How many filters are applied.
 *
 * The search text is excluded: it has its own always-visible field, so
 * counting it would tell a reader two filters are hidden behind the disclosure
 * when only one is. Sort is excluded because it narrows nothing.
 */
export function countActiveFilters(filters: BoardFilters): number {
  return [
    filters.campusId,
    filters.courseId,
    filters.resourceTypeId,
    filters.sessionId,
    filters.status,
  ].filter((value) => value !== null).length;
}

export interface BoardHrefOptions {
  /** Drop every filter but keep what the reader typed. */
  readonly clear?: boolean;
}

export function boardHref(filters: BoardFilters, options: BoardHrefOptions = {}): string {
  const params = new URLSearchParams();

  if (filters.query !== "") {
    params.set("q", filters.query);
  }

  if (options.clear !== true) {
    if (filters.campusId !== null) params.set("campus", filters.campusId);
    if (filters.courseId !== null) params.set("course", filters.courseId);
    if (filters.resourceTypeId !== null) params.set("resource", filters.resourceTypeId);
    if (filters.sessionId !== null) params.set("session", filters.sessionId);
    if (filters.status !== null) params.set("status", filters.status);
    if (filters.sort !== "newest") params.set("sort", filters.sort);
  }

  const query = params.toString();

  return query === "" ? "/board" : `/board?${query}`;
}

/**
 * Matched across the fields a student would actually type.
 *
 * Course code, course name, title, campus, resource type and academic session
 * — someone looking for "segamat" or "past year" should find the request
 * without knowing which field the words live in.
 */
function matchesQuery(wanted: WantedSummary, query: string): boolean {
  if (query === "") {
    return true;
  }

  const haystack = [
    wanted.title,
    wanted.courseCode,
    wanted.courseName,
    wanted.campus,
    wanted.resourceType,
    wanted.session,
  ]
    .join(" ")
    .toLowerCase();

  return query
    .toLowerCase()
    .split(/\s+/)
    .every((term) => haystack.includes(term));
}

function compare(a: WantedSummary, b: WantedSummary, sort: BoardSort): number {
  switch (sort) {
    case "newest":
      return Date.parse(b.postedAt) - Date.parse(a.postedAt);
    case "highest-bounty":
      return b.grossBountySen - a.grossBountySen;
    case "ending-soon":
      return Date.parse(a.closesAt) - Date.parse(b.closesAt);
  }
}

export function applyBoardFilters(
  items: readonly WantedSummary[],
  filters: BoardFilters,
  now: string,
): readonly WantedSummary[] {
  const matched = items.filter(
    (wanted) =>
      matchesQuery(wanted, filters.query) &&
      (filters.campusId === null || wanted.campusId === filters.campusId) &&
      (filters.courseId === null || wanted.courseId === filters.courseId) &&
      (filters.resourceTypeId === null || wanted.resourceTypeId === filters.resourceTypeId) &&
      (filters.sessionId === null || wanted.sessionId === filters.sessionId) &&
      (filters.status === null || wanted.status === filters.status),
  );

  const reference = Date.parse(now);

  /**
   * Sorting by the nearest deadline would otherwise put every expired request
   * at the top, which is the opposite of what "ending soonest" promises. A
   * request whose deadline has passed goes last whatever the order.
   */
  return [...matched].sort((a, b) => {
    if (filters.sort === "ending-soon") {
      const aPast = Date.parse(a.closesAt) <= reference;
      const bPast = Date.parse(b.closesAt) <= reference;

      if (aPast !== bPast) {
        return aPast ? 1 : -1;
      }
    }

    return compare(a, b, filters.sort);
  });
}
