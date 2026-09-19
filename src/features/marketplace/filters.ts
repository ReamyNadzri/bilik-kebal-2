import type { ListWantedQuery } from "@/contracts/marketplace";
import type { BoardFilters, BoardSort, BoardStatus } from "./types";

/**
 * Board filter state, carried in the URL and translated into the published
 * query.
 *
 * Every control on the Board is a plain `GET` field, so a filtered Board is
 * linkable, survives the back button and works before JavaScript loads. This
 * follows the structure settled in
 * `docs/superpowers/specs/2026-09-14-vaultix-identity-screen-design.md` §10.3.
 *
 * Nothing here selects or orders rows. `GET /api/marketplace/wanted` does both,
 * and this module only names the same thing in two vocabularies: the URL values
 * readers already have in their history and bookmarks, and the contract values
 * the server accepts. The URL values are kept and translated rather than
 * changed, because a contract is not something a frontend renames.
 */

export const BOARD_SORTS: readonly { readonly id: BoardSort; readonly label: string }[] = [
  { id: "newest", label: "Newest first" },
  { id: "highest-bounty", label: "Highest bounty" },
  { id: "ending-soon", label: "Ending soonest" },
] as const;

/**
 * The published contract accepts `open` and `reviewing` and nothing else.
 *
 * `ending-soon`, `well-funded` and `closed` remain on the cards, where the
 * server derives them from the closing instant and the bounty — but they are
 * presentations of a request, not lifecycle values the Board can filter by.
 * Offering them here would send a question the server cannot answer.
 */
export const BOARD_STATUSES: readonly { readonly id: BoardStatus; readonly label: string }[] = [
  { id: "open", label: "Open" },
  { id: "reviewing", label: "Under review" },
] as const;

/** URL order to contract order. The URL spelling is the one readers already hold. */
const SORT_TO_CONTRACT: Readonly<Record<BoardSort, NonNullable<ListWantedQuery["sort"]>>> = {
  newest: "newest",
  "highest-bounty": "highest_bounty",
  "ending-soon": "ending_soon",
};

type RawParams = Record<string, string | readonly string[] | undefined>;

function first(raw: string | readonly string[] | undefined): string | undefined {
  return Array.isArray(raw) ? raw[0] : (raw as string | undefined);
}

/**
 * Reads the filters a URL carries.
 *
 * Taxonomy identifiers pass through unvalidated: they are opaque server
 * identifiers, and the Board has no authority to decide which of them exist.
 * One the catalogue does not contain simply matches nothing, which the Board
 * already words as "no request matches these filters" and offers to clear.
 *
 * A status or sort the contract does not accept is dropped rather than
 * forwarded, so a hand-edited URL cannot make the Board ask an invalid
 * question and be refused for it.
 */
export function parseBoardFilters(params: RawParams): BoardFilters {
  const status = first(params["status"]);
  const sort = first(params["sort"]);

  return {
    query: (first(params["q"]) ?? "").trim(),
    campusId: first(params["campus"]) ?? null,
    courseId: first(params["course"]) ?? null,
    resourceTypeId: first(params["resource"]) ?? null,
    sessionId: first(params["session"]) ?? null,
    status: BOARD_STATUSES.some((option) => option.id === status) ? (status as BoardStatus) : null,
    sort: BOARD_SORTS.some((option) => option.id === sort) ? (sort as BoardSort) : "newest",
  };
}

/** The Board's URL state as the published `ListWantedQuery`. */
export function toListWantedQuery(filters: BoardFilters): ListWantedQuery {
  const query: ListWantedQuery = { sort: SORT_TO_CONTRACT[filters.sort] };

  if (filters.query !== "") query.query = filters.query;
  if (filters.campusId !== null) query.campusId = filters.campusId;
  if (filters.courseId !== null) query.courseId = filters.courseId;
  if (filters.resourceTypeId !== null) query.resourceTypeId = filters.resourceTypeId;
  if (filters.sessionId !== null) query.academicSessionId = filters.sessionId;
  if (filters.status !== null) query.status = filters.status;

  return query;
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

/** Whether the reader has narrowed the Board at all, search included. */
export function isNarrowed(filters: BoardFilters): boolean {
  return filters.query !== "" || countActiveFilters(filters) > 0;
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
