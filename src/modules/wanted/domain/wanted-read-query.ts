import type { ListWantedQuery, WantedSummary } from "@/contracts/marketplace";
import { failure, success } from "@/contracts/operation-result";

const statuses = new Set(["open", "reviewing"]);
const sorts = new Set(["newest", "highest_bounty", "ending_soon"]);

export function parseWantedListQuery(search: URLSearchParams) {
  const status = search.get("status");
  const sort = search.get("sort");
  if ((status && !statuses.has(status)) || (sort && !sorts.has(sort))) {
    return failure("VALIDATION_ERROR" as const, "Choose a supported Board filter and sort order.");
  }
  const query: ListWantedQuery = {};
  for (const key of [
    "query",
    "campusId",
    "courseId",
    "resourceTypeId",
    "academicSessionId",
  ] as const) {
    const value = search.get(key)?.trim();
    if (value) query[key] = value;
  }
  if (status) query.status = status as "open" | "reviewing";
  if (sort) query.sort = sort as NonNullable<ListWantedQuery["sort"]>;
  return success(query);
}

export function sortWantedSummaries(
  rows: WantedSummary[],
  sort: ListWantedQuery["sort"] = "newest",
) {
  return [...rows].sort((left, right) => {
    if (sort === "highest_bounty")
      return (
        right.grossBountySen - left.grossBountySen ||
        Date.parse(right.postedAt) - Date.parse(left.postedAt)
      );
    if (sort === "ending_soon")
      return (
        Date.parse(left.closesAt) - Date.parse(right.closesAt) ||
        Date.parse(right.postedAt) - Date.parse(left.postedAt)
      );
    return Date.parse(right.postedAt) - Date.parse(left.postedAt);
  });
}
