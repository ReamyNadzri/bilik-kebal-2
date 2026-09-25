"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  TAXONOMY_CATEGORY_LABEL,
  type TaxonomyRequestCategory,
} from "@/contracts/taxonomy-requests";
import { callOperation } from "@/features/presentation/call-operation";

export interface TaxonomyRequestDialogProps {
  readonly category: TaxonomyRequestCategory;
  /** The faculties (for a programme) or programmes (for a course) to pick from. */
  readonly parents?: readonly { readonly id: string; readonly label: string }[];
  readonly defaultParentId?: string;
  /** Preview mode sends nothing and says so. */
  readonly preview?: boolean;
  readonly onClose: () => void;
}

const PARENT_LABEL: Partial<Record<TaxonomyRequestCategory, string>> = {
  programme: "Faculty it belongs to",
  course: "Programme it belongs to",
};

/**
 * Asks a Sheriff to add a missing entry to the shared lists. Nothing is added
 * straight away: a Sheriff reviews it, and the member is told in the app and
 * by email when it is decided, so the lists stay free of typos and duplicates.
 */
export function TaxonomyRequestDialog({
  category,
  parents = [],
  defaultParentId = "",
  preview = false,
  onClose,
}: TaxonomyRequestDialogProps) {
  const [label, setLabel] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [parentId, setParentId] = useState(defaultParentId);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const noun = TAXONOMY_CATEGORY_LABEL[category].toLowerCase();
  const needsParent = category === "programme" || category === "course";

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (label.trim().length < 2) {
      setStatus({ kind: "error", text: `Enter the ${noun} name.` });
      return;
    }
    if (needsParent && parentId === "") {
      setStatus({ kind: "error", text: `Choose the ${PARENT_LABEL[category]?.toLowerCase()}.` });
      return;
    }
    if (category === "course" && !/^[A-Za-z0-9][A-Za-z0-9-]{1,19}$/.test(courseCode.trim())) {
      setStatus({ kind: "error", text: "Enter the course code, for example CSC508." });
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
        ...(category === "course" ? { courseCode: courseCode.trim() } : {}),
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
    setCourseCode("");
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
            Ask a Sheriff to add a {noun}
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

        {needsParent ? (
          <div className="form-field">
            <label className="form-field__label" htmlFor="taxonomy-request-parent">
              {PARENT_LABEL[category]}
            </label>
            <select
              className="form-field__input"
              id="taxonomy-request-parent"
              value={parentId}
              onChange={(event) => setParentId(event.target.value)}
            >
              <option value="">Choose one</option>
              {parents.map((parent) => (
                <option key={parent.id} value={parent.id}>
                  {parent.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {category === "course" ? (
          <div className="form-field">
            <label className="form-field__label" htmlFor="taxonomy-request-code">
              Course code
            </label>
            <input
              className="form-field__input"
              id="taxonomy-request-code"
              type="text"
              maxLength={20}
              autoCapitalize="characters"
              value={courseCode}
              onChange={(event) => setCourseCode(event.target.value)}
            />
          </div>
        ) : null}

        <div className="form-field">
          <label className="form-field__label" htmlFor="taxonomy-request-label">
            {category === "course" ? "Course name" : `${TAXONOMY_CATEGORY_LABEL[category]} name`}
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
