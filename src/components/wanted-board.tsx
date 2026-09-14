import Link from "next/link";
import { BOARD_FORM_ID, BoardFilters } from "./board-filters";
import { UiStatus } from "./ui-status";
import { WantedCard } from "./wanted-card";
import { BOARD_SORTS, countActiveFilters } from "@/features/marketplace/filters";
import type { BoardFilters as Filters, WantedSummary } from "@/features/marketplace/types";

export interface WantedBoardProps {
  readonly filters: Filters;
  readonly items: readonly WantedSummary[];
  /** How many requests exist before any filter narrowed them. */
  readonly total: number;
  readonly now: string;
}

function describeCount(shown: number, total: number, narrowed: boolean): string {
  const noun = total === 1 ? "Wanted request" : "Wanted requests";

  return narrowed ? `${shown} of ${total} ${noun}` : `${total} ${noun}`;
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
 * this reader's search hid everything. Only the second offers a way to undo.
 */
export function WantedBoard({ filters, items, total, now }: WantedBoardProps) {
  const applied = countActiveFilters(filters);
  const searched = filters.query !== "";
  const narrowed = applied > 0 || searched;

  return (
    <div className="board">
      <div className="board__head">
        <div className="board__search">
          <label className="board__search-label" htmlFor="board-query">
            Search Wanted requests
          </label>
          <div className="board__search-row">
            <input
              className="board__search-input"
              id="board-query"
              form={BOARD_FORM_ID}
              name="q"
              type="search"
              defaultValue={filters.query}
              placeholder="Search course, campus, semester, or resource type"
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
          {total === 0 ? null : (
            <p className="board__count numeric">{describeCount(items.length, total, narrowed)}</p>
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

      <BoardFilters filters={filters} />

      <div className="board__results">
        {total === 0 ? (
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
