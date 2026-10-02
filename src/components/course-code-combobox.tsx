"use client";

import { useEffect, useId, useState, type KeyboardEvent } from "react";
import type { CourseOption } from "@/contracts/marketplace";
import { normaliseCourseCode } from "@/features/marketplace/wanted-draft";
import { matchesQuery } from "./search-select";

interface CourseCodeComboboxProps {
  readonly id: string;
  readonly value: string;
  readonly courses: readonly CourseOption[];
  readonly error: string | undefined;
  readonly onChange: (code: string) => void;
}

const MAX_SHOWN = 8;

/**
 * The course code: free text (a new code is filed by the server), with the
 * known courses suggested in a list the app draws under the field. Same
 * keyboard as SearchSelect, but whatever is typed stays the value.
 */
export function CourseCodeCombobox({
  id,
  value,
  courses,
  error,
  onChange,
}: CourseCodeComboboxProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const matches = courses
    .filter((course) => value === "" || matchesQuery(`${course.code} ${course.label}`, value))
    .slice(0, MAX_SHOWN);
  const showList = open && matches.length > 0;
  const activeOption = showList && active >= 0 ? matches[active] : undefined;
  const optionId = (course: CourseOption) => `${listId}-${course.id}`;
  const activeId = activeOption === undefined ? undefined : optionId(activeOption);

  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = error === undefined ? hintId : `${hintId} ${errorId}`;

  useEffect(() => {
    if (activeId === undefined) return;
    document.getElementById(activeId)?.scrollIntoView?.({ block: "nearest" });
  }, [activeId]);

  function choose(course: CourseOption) {
    onChange(course.code);
    setOpen(false);
    setActive(-1);
  }

  function move(step: number) {
    if (matches.length === 0) return;
    setOpen(true);
    setActive((current) => {
      if (!showList) return step > 0 ? 0 : matches.length - 1;
      return (current + step + matches.length) % matches.length;
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        move(-1);
        break;
      case "Enter":
        // Enter chooses a highlighted suggestion; otherwise the form behaves as usual.
        if (activeOption !== undefined) {
          event.preventDefault();
          choose(activeOption);
        }
        break;
      case "Escape":
        if (showList) {
          event.preventDefault();
          setOpen(false);
          setActive(-1);
        }
        break;
    }
  }

  const count = `${matches.length} ${matches.length === 1 ? "course" : "courses"} found.`;

  return (
    <div className="form-field search-select">
      <label className="form-field__label" htmlFor={id}>
        Course code
        <span className="form-field__required"> (required)</span>
      </label>

      <p className="form-field__hint" id={hintId}>
        Type the subject code in capital letters, for example CSC510.
      </p>

      {error === undefined ? null : (
        <p className="form-field__error" id={errorId}>
          {error}
        </p>
      )}

      <input
        className="form-field__input"
        id={id}
        type="text"
        role="combobox"
        value={value}
        maxLength={12}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={activeId}
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={describedBy}
        onChange={(event) => {
          onChange(normaliseCourseCode(event.target.value));
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
        onBlur={() => {
          setOpen(false);
          setActive(-1);
        }}
      />

      <p className="visually-hidden" aria-live="polite">
        {showList ? count : ""}
      </p>

      <ul
        className="search-select__list"
        id={listId}
        role="listbox"
        aria-label="Known courses"
        hidden={!showList}
      >
        {matches.map((course, index) => (
          <li
            key={course.id}
            id={optionId(course)}
            role="option"
            aria-selected={index === active}
            className={[
              "search-select__option",
              "course-option",
              index === active ? "search-select__option--active" : "",
            ]
              .filter((name) => name !== "")
              .join(" ")}
            // Keeps focus in the text box, so choosing does not blur it first.
            onMouseDown={(event) => {
              event.preventDefault();
              choose(course);
            }}
          >
            <span className="course-option__code">{course.code}</span>{" "}
            {course.label === course.code ? null : (
              <span className="course-option__name">{course.label}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
