"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CLAIM_REVIEW_REASONS, type ClaimReviewQueueItem } from "@/contracts/claim-reviews";

export type ClaimDecision = keyof typeof CLAIM_REVIEW_REASONS;

export const STATUS_LABEL: Record<ClaimReviewQueueItem["status"], string> = {
  screening: "Screening",
  needs_information: "Waiting for the Hunter",
  under_review: "Ready for review",
};

const DECISION_LABEL: Record<ClaimDecision, string> = {
  approve: "Approve",
  request_information: "Request information",
  reject: "Reject",
};

const DECISIONS = Object.keys(DECISION_LABEL) as ClaimDecision[];

const DATE = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kuala_Lumpur",
});

export function ClaimReviewDetail({
  item,
  busy,
  error,
  onDecide,
  onClose,
}: {
  readonly item: ClaimReviewQueueItem;
  readonly busy: boolean;
  readonly error: string;
  readonly onDecide: (decision: ClaimDecision, reasonCode: string, notes: string | null) => void;
  readonly onClose: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [decision, setDecision] = useState<ClaimDecision>("approve");
  const [reasonCode, setReasonCode] = useState<string>(CLAIM_REVIEW_REASONS.approve[0].code);
  const [notes, setNotes] = useState("");
  const headingId = `claim-${item.claimId}`;

  // Opening a claim moves focus to it, so a keyboard or screen reader user
  // lands on the details (above the list on a phone).
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  function chooseDecision(next: ClaimDecision) {
    setDecision(next);
    setReasonCode(CLAIM_REVIEW_REASONS[next][0].code);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    onDecide(decision, reasonCode, notes.trim() || null);
  }

  return (
    <article className="people-detail" aria-labelledby={headingId}>
      <div className="people-detail__head">
        <h3 className="ops-panel__title" id={headingId} tabIndex={-1} ref={headingRef}>
          {item.fileName}
        </h3>
        <button type="button" className="button button--quiet button--compact" onClick={onClose}>
          Back to the list
        </button>
      </div>
      <dl className="index-grid">
        <dt>Wanted</dt>
        <dd>
          {item.wantedPublicId && item.wantedTitle ? (
            <Link href={`/wanted/${item.wantedPublicId}`} prefetch={false}>
              {item.wantedTitle}
            </Link>
          ) : (
            "Not visible to you"
          )}
        </dd>
        <dt>Status</dt>
        <dd>{STATUS_LABEL[item.status]}</dd>
        <dt>File</dt>
        <dd>
          {item.mimeType} · {Math.round(item.sizeBytes / 1024)} KB
        </dd>
        <dt>Submitted</dt>
        <dd>{DATE.format(new Date(item.createdAt))}</dd>
      </dl>
      <p className="ops-alert ops-alert--info">
        Screening is evidence. Your decision is the record.
      </p>

      <form className="ops-form" onSubmit={onSubmit} noValidate aria-label="Record a decision">
        {error ? (
          <p className="form-field__error" role="alert">
            {error}
          </p>
        ) : null}
        <fieldset className="draft-form__fieldset">
          <legend className="draft-form__legend">Decision</legend>
          <div className="draft-form__choices">
            {DECISIONS.map((value) => (
              <label className="draft-form__choice" key={value}>
                <input
                  type="radio"
                  name={`decision-${item.claimId}`}
                  value={value}
                  checked={decision === value}
                  onChange={() => chooseDecision(value)}
                />
                {DECISION_LABEL[value]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="form-field">
          <label className="form-field__label" htmlFor={`${headingId}-reason`}>
            Reason
          </label>
          <select
            className="form-field__input"
            id={`${headingId}-reason`}
            value={reasonCode}
            onChange={(event) => setReasonCode(event.target.value)}
          >
            {CLAIM_REVIEW_REASONS[decision].map((reason) => (
              <option key={reason.code} value={reason.code}>
                {reason.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label className="form-field__label" htmlFor={`${headingId}-notes`}>
            Notes (optional)
          </label>
          <textarea
            className="form-field__input"
            id={`${headingId}-notes`}
            rows={3}
            maxLength={2000}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
        <div>
          <button type="submit" className="button button--primary" disabled={busy}>
            {busy ? "Recording…" : "Record decision"}
          </button>
        </div>
      </form>
    </article>
  );
}
