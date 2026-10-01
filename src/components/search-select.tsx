"use client";

import { useEffect, useId, useState, type KeyboardEvent } from "react";

export interface SearchSelectOption {
  readonly id: string;
  readonly label: string;
}

interface SearchSelectProps {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
  /** The chosen option's id, or "" for none. */
  readonly value: string;
  readonly options: readonly SearchSelectOption[];
  readonly placeholder: string;
  readonly error: string | undefined;
  readonly onChange: (value: string) => void;
  /** One option, for the result count and the empty message: "programme". */
  readonly noun: string;
  /** Its plural, when adding "s" is wrong: "faculties". */
  readonly nounPlural?: string;
}

/** Every word typed appears somewhere in the label, in any order, any case. */
export function matchesQuery(label: string, query: string): boolean {
  const haystack = label.toLocaleLowerCase();
  return query
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter((word) => word !== "")
    .every((word) => haystack.includes(word));
}

/**
 * A required choice from a long list, found by typing: the WAI-ARIA combobox
 * with a listbox popup and manual selection.
 *
 * The text box shows the chosen option until the reader types; typing filters
 * the list, arrow keys move through it, Enter chooses and Escape puts the
 * chosen option back. Leaving the box keeps the choice unless the text left
 * in it names exactly one option, which is then chosen, or is empty, which
 * clears the choice. Text that matches nothing never becomes a value.
 */
export function SearchSelect({
  id,
  label,
  hint,
  value,
  options,
  placeholder,
  error,
  onChange,
  noun,
  nounPlural = `${noun}s`,
}: SearchSelectProps) {
  const listId = useId();
  /** What the reader has typed since the last choice; null shows the choice. */
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const chosen = options.find((option) => option.id === value);
  const matches =
    query === null || query.trim() === ""
      ? options
      : options.filter((option) => matchesQuery(option.label, query));
  const activeOption = open ? matches[active] : undefined;
  const optionId = (option: SearchSelectOption) => `${listId}-${option.id}`;
  const activeId = activeOption === undefined ? undefined : optionId(activeOption);

  const hintId = hint === undefined ? undefined : `${id}-hint`;
  const errorId = error === undefined ? undefined : `${id}-error`;
  const describedBy = [hintId, errorId].filter((entry) => entry !== undefined).join(" ");

  useEffect(() => {
    if (activeId === undefined) return;
    document.getElementById(activeId)?.scrollIntoView?.({ block: "nearest" });
  }, [activeId]);

  function choose(option: SearchSelectOption) {
    onChange(option.id);
    setQuery(null);
    setOpen(false);
  }

  function openAt(index: number) {
    setOpen(true);
    setActive(Math.max(0, Math.min(index, matches.length - 1)));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        openAt(open ? active + 1 : chosen === undefined ? 0 : matches.indexOf(chosen));
        break;
      case "ArrowUp":
        event.preventDefault();
        openAt(open ? active - 1 : matches.length - 1);
        break;
      case "Enter":
        // Enter chooses; it never submits the form around the field.
        if (open && activeOption !== undefined) {
          event.preventDefault();
          choose(activeOption);
        }
        break;
      case "Escape":
        if (open || query !== null) {
          event.preventDefault();
          setQuery(null);
          setOpen(false);
        }
        break;
    }
  }

  function onBlur() {
    setOpen(false);
    if (query === null) return;
    if (query.trim() === "") {
      onChange("");
    } else if (matches.length === 1 && matches[0] !== undefined) {
      onChange(matches[0].id);
    }
    setQuery(null);
  }

  const count = `${matches.length} ${matches.length === 1 ? noun : nounPlural} found.`;

  return (
    <div className="form-field search-select">
      <label className="form-field__label" htmlFor={id}>
        {label}
        <span className="form-field__required"> (required)</span>
      </label>

      {hint === undefined ? null : (
        <p className="form-field__hint" id={hintId}>
          {hint}
        </p>
      )}

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
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={query ?? chosen?.label ?? ""}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={activeId}
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={describedBy === "" ? undefined : describedBy}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActive(0);
        }}
        onClick={() => {
          if (!open) openAt(0);
        }}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
      />

      <p className="visually-hidden" aria-live="polite">
        {open ? count : ""}
      </p>

      <ul
        className="search-select__list"
        id={listId}
        role="listbox"
        aria-label={`Matching ${nounPlural}`}
        hidden={!open}
      >
        {matches.length === 0 ? (
          <li className="search-select__empty" role="presentation">
            No {noun} matches &ldquo;{query}&rdquo;.
          </li>
        ) : (
          matches.map((option, index) => (
            <li
              key={option.id}
              id={optionId(option)}
              role="option"
              aria-selected={index === active}
              className={[
                "search-select__option",
                index === active ? "search-select__option--active" : "",
                option.id === value ? "search-select__option--chosen" : "",
              ]
                .filter((name) => name !== "")
                .join(" ")}
              // Keeps focus in the text box, so choosing does not blur it first.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(option)}
            >
              {option.label}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
