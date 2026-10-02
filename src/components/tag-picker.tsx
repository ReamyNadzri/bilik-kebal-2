"use client";

import { useState, type KeyboardEvent } from "react";
import type { TaxonomyItem } from "@/contracts/marketplace";
import { callOperation } from "@/features/presentation/call-operation";

/** A Wanted carries at most this many tags; the database refuses more. */
export const MAX_TAGS = 5;

/**
 * Adds a member's own tag, or finds it whatever its case (`ensure_tag`). The
 * server checks who is asking and the name; the message is the server's.
 */
export function requestTag(name: string) {
  return callOperation<TaxonomyItem, string>(
    "/api/marketplace/tags",
    { name },
    "TAXONOMY_UNAVAILABLE",
  );
}

interface TagPickerProps {
  /** Prefix for element ids: "wanted" gives wanted-tags and wanted-new-tag. */
  readonly idPrefix: string;
  readonly tags: readonly TaxonomyItem[];
  readonly selected: readonly string[];
  readonly error?: string | undefined;
  readonly onToggle: (tagId: string, checked: boolean) => void;
  /**
   * Adds or finds the named tag and ticks it. Resolves to a notice for the
   * reader when it could not, or null when the tag is ticked.
   */
  readonly onAdd: (name: string) => Promise<string | null>;
}

/** Tags as ticks, plus a box to add one's own, up to five in all. */
export function TagPicker({ idPrefix, tags, selected, error, onToggle, onAdd }: TagPickerProps) {
  const [newTag, setNewTag] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const fieldsetId = `${idPrefix}-tags`;
  const inputId = `${idPrefix}-new-tag`;
  const full = selected.length >= MAX_TAGS;

  async function add() {
    const name = newTag.trim().replace(/\s+/g, " ");
    if (name === "" || adding) return;
    setNotice(null);
    setAdding(true);
    const refusal = await onAdd(name);
    setAdding(false);
    if (refusal === null) setNewTag("");
    else setNotice(refusal);
  }

  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    // Enter adds the tag rather than submitting the whole form.
    if (event.key === "Enter") {
      event.preventDefault();
      void add();
    }
  }

  return (
    <fieldset className="draft-form__fieldset" id={fieldsetId}>
      <legend className="draft-form__legend">Tags (optional, up to five)</legend>
      {error === undefined ? null : (
        <p className="form-field__error" id={`${fieldsetId}-error`}>
          {error}
        </p>
      )}
      {tags.length === 0 ? (
        <p className="form-field__hint">No tags yet. Add the first one below.</p>
      ) : (
        <div className="draft-form__choices">
          {tags.map((tag) => (
            <label className="draft-form__choice" key={tag.id}>
              <input
                type="checkbox"
                checked={selected.includes(tag.id)}
                disabled={!selected.includes(tag.id) && full}
                onChange={(event) => onToggle(tag.id, event.target.checked)}
              />
              {tag.label}
            </label>
          ))}
        </div>
      )}
      <div className="form-field draft-form__new-tag">
        <label className="form-field__label" htmlFor={inputId}>
          Add your own tag
        </label>
        <p className="form-field__hint" id={`${inputId}-hint`}>
          Any word that helps classmates find it, for example Past Year or Calculus.
        </p>
        {notice === null ? null : (
          <p className="form-field__error" id={`${inputId}-error`} role="alert">
            {notice}
          </p>
        )}
        <div className="draft-form__new-tag-row">
          <input
            className="form-field__input"
            id={inputId}
            type="text"
            maxLength={30}
            autoComplete="off"
            value={newTag}
            aria-describedby={
              notice === null ? `${inputId}-hint` : `${inputId}-hint ${inputId}-error`
            }
            onChange={(event) => setNewTag(event.target.value)}
            onKeyDown={onKey}
          />
          <button
            type="button"
            className="button button--secondary"
            onClick={() => void add()}
            disabled={adding || newTag.trim().length < 2 || full}
          >
            {adding ? "Adding…" : "Add tag"}
          </button>
        </div>
      </div>
    </fieldset>
  );
}
