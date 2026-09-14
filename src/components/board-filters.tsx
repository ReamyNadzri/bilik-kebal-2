import Link from "next/link";
import { BOARD_STATUSES, boardHref, countActiveFilters } from "@/features/marketplace/filters";
import { CAMPUSES, COURSES, RESOURCE_TYPES, SESSIONS } from "@/features/marketplace/fixtures";
import type { BoardFilters as Filters, TaxonomyOption } from "@/features/marketplace/types";

export const BOARD_FORM_ID = "board-filters";

interface FilterSelectProps {
  readonly name: string;
  readonly label: string;
  readonly anyLabel: string;
  readonly options: readonly TaxonomyOption[];
  readonly value: string | null;
}

function FilterSelect({ name, label, anyLabel, options, value }: FilterSelectProps) {
  const id = `board-filter-${name}`;

  return (
    <p className="board-filters__field">
      <label className="board-filters__label" htmlFor={id}>
        {label}
      </label>
      <select className="board-filters__select" id={id} name={name} defaultValue={value ?? ""}>
        <option value="">{anyLabel}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </p>
  );
}

export interface BoardFiltersProps {
  readonly filters: Filters;
}

/**
 * The Board's filter rail.
 *
 * A plain `GET` form: no JavaScript decides what is shown, the filtered Board
 * is a linkable address, and the back button behaves. The search field and the
 * sort control live elsewhere on the page and join this form through the
 * `form` attribute, so the whole Board submits as one request rather than
 * losing the filters whenever the sort changes.
 *
 * At 360 px the rail collapses into a disclosure whose summary reports the
 * applied count in words. At the rail's own breakpoint the summary is removed
 * and the body is forced open in CSS, so the same markup serves both without a
 * second copy of the controls.
 */
export function BoardFilters({ filters }: BoardFiltersProps) {
  const applied = countActiveFilters(filters);
  const appliedLabel =
    applied === 0 ? "No filters applied" : `${applied} filter${applied === 1 ? "" : "s"} applied`;

  return (
    <form className="board-filters" id={BOARD_FORM_ID} action="/board" method="get">
      {/* The rail's caption at desktop, where the disclosure summary is not
          rendered. Exactly one of the two is displayed at any width, so the
          count is never announced twice. */}
      <p className="board-filters__caption">
        <span className="board-filters__summary-label">Filters</span>
        <span className="board-filters__summary-count">{appliedLabel}</span>
      </p>

      <details className="board-filters__disclosure" open={applied > 0}>
        <summary className="board-filters__summary">
          <span className="board-filters__summary-label">Filters</span>
          <span className="board-filters__summary-count">{appliedLabel}</span>
        </summary>

        <div className="board-filters__body">
          <FilterSelect
            name="campus"
            label="Campus"
            anyLabel="All campuses"
            options={CAMPUSES}
            value={filters.campusId}
          />
          <FilterSelect
            name="course"
            label="Course"
            anyLabel="All courses"
            options={COURSES}
            value={filters.courseId}
          />
          <FilterSelect
            name="resource"
            label="Resource type"
            anyLabel="All resource types"
            options={RESOURCE_TYPES}
            value={filters.resourceTypeId}
          />
          <FilterSelect
            name="session"
            label="Academic session"
            anyLabel="All sessions"
            options={SESSIONS}
            value={filters.sessionId}
          />
          <FilterSelect
            name="status"
            label="Status"
            anyLabel="Any status"
            options={BOARD_STATUSES}
            value={filters.status}
          />

          <div className="board-filters__actions">
            <button className="button button--secondary" type="submit">
              Apply filters
            </button>
            {applied === 0 ? null : (
              <Link className="board-filters__clear" href={boardHref(filters, { clear: true })}>
                Clear all filters
              </Link>
            )}
          </div>
        </div>
      </details>
    </form>
  );
}
