import Link from "next/link";
import { BOARD_FORM_ID, BoardFilters } from "./board-filters";
import { UiStatus } from "./ui-status";
import { WantedCard } from "./wanted-card";
import type { MarketplaceTaxonomy } from "@/contracts/marketplace";
import { BOARD_SORTS, isNarrowed } from "@/features/marketplace/filters";
import type { BoardFilters as Filters, WantedSummary } from "@/features/marketplace/types";

export interface WantedBoardProps {
  readonly filters: Filters;
  /** Exactly the rows the server selected for this query. */
  readonly items: readonly WantedSummary[];
  readonly taxonomy: MarketplaceTaxonomy | null;
  readonly now: string;
}

/**
 * How many requests this view holds.
 *
 * Only what the server returned, never "N of M": a total across the whole
 * Board would be a second unfiltered read, and inventing one from the filtered
 * page would be a number nobody counted.
 */
function describeCount(shown: number, narrowed: boolean): string {
  const noun = shown === 1 ? "Wanted request" : "Wanted requests";

  return narrowed ? `${shown} matching ${noun}` : `${shown} ${noun}`;
}

/**
 * The Wanted Board: search, filters, sort and results.
 *
 * Every control is a field of one `GET` form. The search box and the sort
 * control sit in the header for reading order but join the rail's form through
 * the `form` attribute, so a reader changing the sort keeps their filters and
 * a filtered Board is an address someone can send to a classmate.
 *
 * An empty Board and a Board with no matches are different situations and are
 * worded differently: one means nobody has asked for anything, the other means
 * this reader's search hid everything. Only the second offers a way to undo,
 * and neither is a failure — an empty result from a successful read is still a
 * successful read.
 */
export function WantedBoard({ filters, items, taxonomy, now }: WantedBoardProps) {
  const searched = filters.query !== "";
  const narrowed = isNarrowed(filters);

  return (
    <div className="board">
      <div className="panel board__head">
        <div className="board__search">
          <label className="board__search-label" htmlFor="board-query">
            Search Wanted requests
          </label>
          {/* The published read matches the request title only. Offering to
              search a campus or a semester would promise a result the operation
              cannot return, and the campus, course, resource and session
              filters below already narrow by those. */}
          <div className="board__search-row">
            <input
              className="board__search-input"
              id="board-query"
              form={BOARD_FORM_ID}
              name="q"
              type="search"
              defaultValue={filters.query}
              placeholder="Search request titles"
            />
            <button
              className="button button--secondary"
              type="submit"
              form={BOARD_FORM_ID}
              aria-label="Search the Board"
            >
              Search
            </button>
          </div>
        </div>

        <div className="board__summary">
          {items.length === 0 ? null : (
            <p className="board__count numeric">{describeCount(items.length, narrowed)}</p>
          )}

          <p className="board__sort">
            <label className="board__sort-label" htmlFor="board-sort">
              Sort by
            </label>
            <select
              className="board__sort-select"
              id="board-sort"
              form={BOARD_FORM_ID}
              name="sort"
              defaultValue={filters.sort}
            >
              {BOARD_SORTS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </p>
        </div>
      </div>

      <BoardFilters filters={filters} taxonomy={taxonomy} />

      <div className="board-surface board__results">
        {items.length === 0 && !narrowed ? (
          <UiStatus
            kind="empty"
            heading="Nothing is on the Board yet"
            message="No student has posted a request. The first one can be yours."
            action={
              <Link className="button button--primary" href="/wanted/new">
                Post a Wanted
              </Link>
            }
          />
        ) : items.length === 0 ? (
          <UiStatus
            kind="empty"
            heading={
              searched ? "No request matches this search" : "No request matches these filters"
            }
            message={
              searched
                ? "Try fewer words, a course code, or a campus name. Clearing the filters widens the Board again."
                : "Every request was excluded by the filters. Clearing them shows the whole Board again."
            }
            action={<Link href="/board">Clear the search and filters</Link>}
          />
        ) : (
          <ul className="wanted-grid" aria-label="Wanted requests">
            {items.map((wanted) => (
              <WantedCard key={wanted.id} wanted={wanted} now={now} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
