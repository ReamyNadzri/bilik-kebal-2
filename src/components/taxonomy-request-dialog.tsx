"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  TAXONOMY_CATEGORY_LABEL,
  taxonomyRequestCategories,
  type TaxonomyRequestCategory,
} from "@/contracts/taxonomy-requests";
import { callOperation } from "@/features/presentation/call-operation";

/**
 * What a member can ask for. Not a course: members type the course code on the
 * request itself, and a new code is added to the list as it is posted.
 */
export const REQUESTABLE_CATEGORIES: readonly TaxonomyRequestCategory[] =
  taxonomyRequestCategories.filter((category) => category !== "course");

export interface TaxonomyRequestDialogProps {
  /** What is missing, when the member has already said; they can change it. */
  readonly initialCategory?: TaxonomyRequestCategory;
  /** The faculties a new programme can belong to. */
  readonly faculties?: readonly { readonly id: string; readonly label: string }[];
  readonly defaultFacultyId?: string;
  /** Preview mode sends nothing and says so. */
  readonly preview?: boolean;
  readonly onClose: () => void;
}

/**
 * Asks a Sheriff to add a missing entry to the shared lists: one place to ask
 * for any of them, with the kind of entry chosen inside. Nothing is added
 * straight away: a Sheriff reviews it, and the member is told in the app and
 * by email when it is decided, so the lists stay free of typos and duplicates.
 */
export function TaxonomyRequestDialog({
  initialCategory,
  faculties = [],
  defaultFacultyId = "",
  preview = false,
  onClose,
}: TaxonomyRequestDialogProps) {
  const [category, setCategory] = useState<TaxonomyRequestCategory | "">(initialCategory ?? "");
  const [label, setLabel] = useState("");
  const [parentId, setParentId] = useState(defaultFacultyId);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const noun = category === "" ? "entry" : TAXONOMY_CATEGORY_LABEL[category].toLowerCase();
  const needsParent = category === "programme";

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (category === "") {
      setStatus({ kind: "error", text: "Choose what is missing." });
      return;
    }
    if (label.trim().length < 2) {
      setStatus({ kind: "error", text: `Enter the ${noun} name.` });
      return;
    }
    if (needsParent && parentId === "") {
      setStatus({ kind: "error", text: "Choose the faculty it belongs to." });
      return;
    }
    if (preview) {
      setStatus({
        kind: "ok",
        text: "Preview only: nothing was sent. The real screen sends this to a Sheriff.",
      });
      return;
    }
    setBusy(true);
    setStatus(null);
    const result = await callOperation<{ requestId: string }, string>(
      "/api/marketplace/taxonomy-requests",
      {
        category,
        label: label.trim(),
        ...(needsParent ? { parentId } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      },
      "TAXONOMY_REQUESTS_UNAVAILABLE",
    );
    setBusy(false);
    if (!result.ok) {
      setStatus({ kind: "error", text: result.message || "Your request could not be sent." });
      return;
    }
    setStatus({
      kind: "ok",
      text: `Sent. A Sheriff will review “${label.trim()}”, and you will be notified here and by email when it is decided.`,
    });
    setLabel("");
    setNote("");
  }

  return (
    <div
      className="dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="taxonomy-request-title"
      ref={dialogRef}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !busy) onClose();
      }}
    >
      <form className="dialog" onSubmit={onSubmit} noValidate>
        <div className="dialog__head">
          <h2 id="taxonomy-request-title" className="dialog__title">
            Ask a Sheriff to add something
          </h2>
          <button
            type="button"
            className="button button--quiet dialog__close"
            onClick={onClose}
            aria-label="Close dialog"
            disabled={busy}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <p className="dialog__lede">
          Can&rsquo;t find it in the list? Tell us what is missing. A Sheriff checks it before it is
          added for everyone, and you will be told in the app and by email.
        </p>

        {status ? (
          <p
            className={`ops-alert ${status.kind === "ok" ? "ops-alert--success" : "ops-alert--error"}`}
            role={status.kind === "ok" ? "status" : "alert"}
          >
            {status.text}
          </p>
        ) : null}

        <div className="form-field">
          <label className="form-field__label" htmlFor="taxonomy-request-category">
            What is missing?
          </label>
          <select
            className="form-field__input"
            id="taxonomy-request-category"
            value={category}
            onChange={(event) => {
              setCategory(event.target.value as TaxonomyRequestCategory | "");
              setStatus(null);
            }}
          >
            <option value="">Choose one</option>
            {REQUESTABLE_CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {TAXONOMY_CATEGORY_LABEL[option]}
              </option>
            ))}
          </select>
        </div>

        {needsParent ? (
          <div className="form-field">
            <label className="form-field__label" htmlFor="taxonomy-request-parent">
              Faculty it belongs to
            </label>
            <select
              className="form-field__input"
              id="taxonomy-request-parent"
              value={parentId}
              onChange={(event) => setParentId(event.target.value)}
            >
              <option value="">Choose one</option>
              {faculties.map((faculty) => (
                <option key={faculty.id} value={faculty.id}>
                  {faculty.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="form-field">
          <label className="form-field__label" htmlFor="taxonomy-request-label">
            {category === "" ? "Name" : `${TAXONOMY_CATEGORY_LABEL[category]} name`}
          </label>
          <input
            className="form-field__input"
            id="taxonomy-request-label"
            type="text"
            maxLength={160}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
          />
        </div>

        <div className="form-field">
          <label className="form-field__label" htmlFor="taxonomy-request-note">
            Anything the Sheriff should know{" "}
            <span className="form-field__required">(optional)</span>
          </label>
          <textarea
            className="form-field__input"
            id="taxonomy-request-note"
            rows={2}
            maxLength={500}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>

        <div className="dialog__actions">
          <button type="button" className="button button--quiet" onClick={onClose} disabled={busy}>
            Close
          </button>
          <button type="submit" className="button button--primary" disabled={busy}>
            {busy ? "Sending…" : "Send to a Sheriff"}
          </button>
        </div>
      </form>
    </div>
  );
}
