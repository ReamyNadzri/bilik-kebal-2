"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CLAIM_REVIEW_REASONS, type ClaimReviewQueueItem } from "@/contracts/claim-reviews";
import { ClaimReviewFile } from "./claim-review-file";

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
  // Nothing is preselected: a decision is a deliberate choice, never a default.
  const [decision, setDecision] = useState<ClaimDecision | null>(null);
  const [reasonCode, setReasonCode] = useState("");
  const [notes, setNotes] = useState("");
  const [confirming, setConfirming] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const returnToSubmit = useRef(false);
  const ready = decision !== null && reasonCode !== "";
  const headingId = `claim-${item.claimId}`;

  // Opening a claim moves focus to it, so a keyboard or screen reader user
  // lands on the details (above the list on a phone).
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    if (confirming) {
      confirmRef.current?.focus();
    } else if (returnToSubmit.current) {
      returnToSubmit.current = false;
      submitRef.current?.focus();
    }
  }, [confirming]);

  function chooseDecision(next: ClaimDecision) {
    setDecision(next);
    setReasonCode("");
    setConfirming(false);
  }

  function record() {
    if (busy || decision === null || reasonCode === "") return;
    onDecide(decision, reasonCode, notes.trim() || null);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !ready) return;
    // Approving picks the winner and starts fulfilment, so it is confirmed first.
    if (decision === "approve") {
      setConfirming(true);
      return;
    }
    record();
  }

  function cancelConfirm() {
    returnToSubmit.current = true;
    setConfirming(false);
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
      <ClaimReviewFile claimId={item.claimId} fileName={item.fileName} mimeType={item.mimeType} />
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
            disabled={decision === null}
            onChange={(event) => {
              setReasonCode(event.target.value);
              setConfirming(false);
            }}
          >
            <option value="">
              {decision === null ? "Choose a decision first" : "Choose a reason"}
            </option>
            {(decision === null ? [] : CLAIM_REVIEW_REASONS[decision]).map((reason) => (
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
        {confirming ? (
          <div className="ops-alert ops-alert--warning" role="group" aria-label="Confirm approval">
            <p>
              Approve this claim? This selects it as the winner and starts fulfilment: other open
              claims on this Wanted are not selected, the Wanted is marked fulfilled, its backers
              (or the poster of a free request) get access to the file, and any bounty is queued for
              payout to the Hunter.
            </p>
            <div className="profile-form__actions">
              <button
                type="button"
                className="button button--primary"
                ref={confirmRef}
                disabled={busy}
                onClick={record}
              >
                {busy ? "Recording…" : "Confirm approval"}
              </button>
              <button type="button" className="button button--quiet" onClick={cancelConfirm}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            <button
              type="submit"
              className="button button--primary"
              ref={submitRef}
              disabled={busy || !ready}
            >
              {busy ? "Recording…" : "Record decision"}
            </button>
          </div>
        )}
      </form>
    </article>
  );
}
