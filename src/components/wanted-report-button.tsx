"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  WANTED_REPORT_CATEGORIES,
  WANTED_REPORT_LABEL,
  type WantedReportCategory,
  type WantedReportCode,
} from "@/contracts/wanted-reports";
import { callOperation } from "@/features/presentation/call-operation";
import { PixelIcon } from "./pixel-icon";

export interface WantedReportButtonProps {
  /** The Wanted's public id. */
  readonly wantedId: string;
  readonly title: string;
  readonly className?: string;
}

/**
 * Report, an icon-only flag beside Share on a Wanted, offered to
 * institution-verified members who did not post it (the page decides when to
 * show it; the database refuses anyone else). It opens a dialog: a reason, an
 * optional note, Send. A report goes privately to the Sheriffs and the Owner
 * and changes nothing by itself.
 */
export function WantedReportButton({
  wantedId,
  title,
  className = "button button--secondary button--compact",
}: WantedReportButtonProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`wanted-report ${className}`.trim()}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label="Report this Wanted"
        title="Report"
      >
        <PixelIcon name="flag" className="shell-nav__icon" />
      </button>
      {open ? (
        <ReportDialog
          wantedId={wantedId}
          title={title}
          onClose={() => {
            setOpen(false);
            buttonRef.current?.focus();
          }}
        />
      ) : null}
    </>
  );
}

function ReportDialog({
  wantedId,
  title,
  onClose,
}: {
  readonly wantedId: string;
  readonly title: string;
  readonly onClose: () => void;
}) {
  const headingId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [category, setCategory] = useState<WantedReportCategory | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<"reported" | "already_reported" | null>(null);

  useEffect(() => {
    dialogRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (category === null) {
      setError("Choose a reason.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await callOperation<
      { outcome: "reported" | "already_reported" },
      WantedReportCode
    >(
      `/api/marketplace/wanted/${encodeURIComponent(wantedId)}/report`,
      details.trim() === "" ? { category } : { category, details },
      "REPORTS_UNAVAILABLE",
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.message || "Your report could not be sent. Try again.");
      return;
    }
    setSent(result.data.outcome);
  }

  return (
    <div
      className="dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      ref={dialogRef}
      tabIndex={-1}
    >
      <div className="dialog">
        <div className="dialog__head">
          <h2 id={headingId} className="dialog__title">
            Report this Wanted
          </h2>
          <button
            type="button"
            className="button button--quiet dialog__close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        {sent !== null ? (
          <div className="report-dialog__done" role="status">
            <p>
              {sent === "reported"
                ? "Thank you. Your report went privately to the Sheriffs, who will look at it."
                : "You have already reported this Wanted. The Sheriffs have your report."}
            </p>
            <button type="button" className="button button--primary" onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <form className="report-dialog" onSubmit={send} noValidate>
            <p className="form-field__hint">
              &ldquo;{title}&rdquo;. Only Sheriffs and the Owner see reports; the poster is not told
              who reported.
            </p>
            {error === null ? null : (
              <p className="form-field__error" role="alert">
                {error}
              </p>
            )}
            <fieldset className="draft-form__fieldset">
              <legend className="draft-form__legend">Why are you reporting it?</legend>
              <div className="report-dialog__choices">
                {WANTED_REPORT_CATEGORIES.map((item) => (
                  <label className="draft-form__choice" key={item}>
                    <input
                      type="radio"
                      name="report-category"
                      value={item}
                      checked={category === item}
                      onChange={() => setCategory(item)}
                    />
                    {WANTED_REPORT_LABEL[item]}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="form-field">
              <label className="form-field__label" htmlFor="report-details">
                Anything a Sheriff should know{" "}
                <span className="form-field__required">(optional)</span>
              </label>
              <textarea
                className="form-field__input"
                id="report-details"
                rows={3}
                maxLength={500}
                value={details}
                onChange={(event) => setDetails(event.target.value)}
              />
            </div>
            <div className="dialog__actions">
              <button type="button" className="button button--secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="button button--primary" disabled={busy}>
                {busy ? "Sending…" : "Send report"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
