"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { UiStatus } from "./ui-status";
import type {
  EvidenceReadResult,
  ReviewVerificationResult,
  VerificationQueueItem,
} from "@/contracts";
import type { VerificationOperationCode } from "@/contracts";
import { callOperation } from "@/features/presentation/call-operation";
import { IDENTITY_MESSAGE } from "@/features/presentation/identity-messages";

export interface ReviewConsoleProps {
  items: readonly VerificationQueueItem[];
}

type Decision = "approved" | "rejected";

type Evidence =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "open"; signedUrl: string; expiresAt: string }
  | { kind: "failed"; message: string };

type Review =
  | { kind: "idle" }
  | { kind: "confirming"; decision: Decision }
  | { kind: "recording"; decision: Decision }
  | { kind: "failed"; decision: Decision; message: string; stale: boolean }
  | { kind: "done"; decision: Decision };

/**
 * The shape the review operation accepts. Mirrored here only for fast feedback;
 * the operation re-validates and is the authority.
 *
 * Deliberately not a list of options: the moderation reason-code catalogue is
 * still an open question in context/progress-tracker.md, and presenting an
 * invented list as approved values would put words in a Sheriff's mouth.
 */
const REASON_CODE = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" });

function formatDate(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? "Unknown date" : DATE_FORMAT.format(parsed);
}

function formatTime(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime())
    ? "shortly"
    : new Intl.DateTimeFormat("en-GB", { timeStyle: "short", timeZone: "UTC" }).format(parsed);
}

function messageFor(code: VerificationOperationCode, message: string): string {
  return message === "" ? IDENTITY_MESSAGE[code] : message;
}

const CONSEQUENCE: Record<Decision, string> = {
  approved:
    "Approving confirms this person's institution affiliation. It grants the star emblem and permits funding a bounty, submitting a claim and downloading an entitled resource.",
  rejected:
    "Rejecting withholds institution verification. The applicant keeps metadata browsing, cannot fund, claim or download, and is shown the reason code you record.",
};

/**
 * Sheriff Console: the pending institution verification queue.
 *
 * Role and institution scope are enforced server-side and by RLS on every
 * operation this screen calls. What is rendered here is a convenience, never a
 * control — the queue itself arrives already scoped, and each decision is
 * re-checked when it is submitted.
 *
 * The signed evidence URL is minted only when a reviewer opens the viewer, held
 * in state for the life of that dialog, and dropped on close. It is never
 * rendered as text, never persisted, and never put in an error message.
 */
export function ReviewConsole({ items }: ReviewConsoleProps) {
  const [queue, setQueue] = useState<readonly VerificationQueueItem[]>(items);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<Evidence>({ kind: "idle" });
  const [review, setReview] = useState<Review>({ kind: "idle" });
  const [reasonCode, setReasonCode] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const evidenceTriggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);

  const selected = queue.find((item) => item.requestId === selectedId) ?? null;

  // Move focus into the viewer when it opens, and restore it on close.
  useEffect(() => {
    if (evidence.kind === "open") {
      dialogRef.current?.focus();
    }
  }, [evidence.kind]);

  useEffect(() => {
    if (evidence.kind !== "open") {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeEvidence();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [evidence.kind]);

  function closeEvidence() {
    // Dropped rather than kept for a possible re-open: a signed URL to someone
    // else's identity document should live no longer than the dialog.
    setEvidence({ kind: "idle" });
    evidenceTriggerRef.current?.focus();
  }

  function selectRequest(requestId: string) {
    setSelectedId(requestId);
    setEvidence({ kind: "idle" });
    setReview({ kind: "idle" });
    setReasonCode("");
    setReasonError(null);
  }

  async function openEvidence(requestId: string) {
    if (busyRef.current) {
      return;
    }

    busyRef.current = true;
    setEvidence({ kind: "loading" });

    try {
      const result = (await callOperation<
        { signedUrl: string; expiresAt: string },
        VerificationOperationCode
      >(
        "/api/identity/verification-requests/evidence-url",
        { requestId },
        "AUTH_UNAVAILABLE",
      )) as EvidenceReadResult;

      if (result.ok) {
        setEvidence({
          kind: "open",
          signedUrl: result.data.signedUrl,
          expiresAt: result.data.expiresAt,
        });
        return;
      }

      // The failure never echoes the URL, the key, or the provider response.
      setEvidence({ kind: "failed", message: messageFor(result.code, result.message) });
    } finally {
      busyRef.current = false;
    }
  }

  function startDecision(decision: Decision) {
    const trimmed = reasonCode.trim();

    if (trimmed === "") {
      setReasonError("Enter a reason code for this decision.");
      return;
    }

    if (!REASON_CODE.test(trimmed)) {
      // Distinct from the hint above it, which already states the format: an
      // error that repeats the hint tells the reviewer nothing new.
      setReasonError("That reason code cannot be used. Remove spaces, capitals and punctuation.");
      return;
    }

    setReasonError(null);
    setReview({ kind: "confirming", decision });
  }

  async function confirmDecision(item: VerificationQueueItem, decision: Decision) {
    if (busyRef.current) {
      return;
    }

    busyRef.current = true;
    setReview({ kind: "recording", decision });

    try {
      const result = (await callOperation<{ status: Decision }, VerificationOperationCode>(
        "/api/identity/verification-requests/review",
        {
          requestId: item.requestId,
          institutionId: item.institutionId,
          decision,
          reasonCode: reasonCode.trim(),
        },
        "AUTH_UNAVAILABLE",
      )) as ReviewVerificationResult;

      if (result.ok) {
        setReview({ kind: "done", decision: result.data.status });
        // Worded differently from the sentence rendered below, so a screen
        // reader is not read the same thing twice.
        setAnnouncement(
          result.data.status === "approved" ? "Approval recorded." : "Rejection recorded.",
        );
        setQueue((current) => current.filter((row) => row.requestId !== item.requestId));
        return;
      }

      setReview({
        kind: "failed",
        decision,
        message: messageFor(result.code, result.message),
        stale: result.code === "VERIFICATION_CONFLICT" || result.code === "REQUEST_NOT_FOUND",
      });
    } finally {
      busyRef.current = false;
    }
  }

  const recording = review.kind === "recording";

  return (
    <div className="review-console">
      <p className="visually-hidden" data-testid="review-announcer" aria-live="polite">
        {announcement}
      </p>

      {review.kind === "done" ? (
        <p className="review-console__decided">
          {review.decision === "approved" ? "Request approved." : "Request rejected."} The applicant
          has been updated.
        </p>
      ) : null}

      {queue.length === 0 ? (
        <UiStatus
          kind="empty"
          heading="No requests are waiting for review"
          message="Institution verification requests appear here as they are submitted. Claims, reports and appeals arrive in a later phase."
        />
      ) : (
        <div className="review-console__panes">
          <section className="review-console__queue">
            <h2>Pending requests</h2>

            <ul
              className="review-queue"
              aria-label={`Verification requests, ${queue.length} waiting`}
            >
              {queue.map((item) => (
                <li key={item.requestId} className="review-queue__item">
                  <button
                    type="button"
                    className="review-queue__row"
                    aria-current={item.requestId === selectedId ? "true" : undefined}
                    onClick={() => selectRequest(item.requestId)}
                  >
                    <span className="review-queue__name">{item.applicantDisplayName}</span>
                    <span className="review-queue__institution">{item.institutionName}</span>
                    <span className="review-queue__date">
                      Submitted {formatDate(item.submittedAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="review-console__detail">
            {selected === null ? (
              <UiStatus
                kind="empty"
                heading="Choose a request to review"
                message="Select a request from the queue to see its details and open its evidence."
              />
            ) : (
              <>
                <h2>{selected.applicantDisplayName}</h2>

                <dl className="account-summary__details">
                  <dt>Institution</dt>
                  <dd>{selected.institutionName}</dd>
                  <dt>Submitted</dt>
                  <dd>{formatDate(selected.submittedAt)}</dd>
                  <dt>Evidence deleted after</dt>
                  <dd>{formatDate(selected.evidenceDeleteAfter)}</dd>
                </dl>

                <aside
                  className="privacy-note"
                  role="note"
                  aria-label="How this evidence is handled"
                >
                  <h3 className="privacy-note__heading">How this evidence is handled</h3>
                  <p>
                    This document belongs to the applicant. Opening it is recorded against your
                    account. Do not download, copy, or share it. It is deleted 30 days after the
                    decision and any appeal period ends.
                  </p>
                </aside>

                <p className="review-console__disclaimer">
                  Institution verification confirms affiliation only. It is not a judgement of the
                  applicant or a statement about the quality of anything they may later submit.
                </p>

                <button
                  type="button"
                  className="auth-form__submit"
                  ref={evidenceTriggerRef}
                  onClick={() => openEvidence(selected.requestId)}
                  aria-disabled={evidence.kind === "loading" ? true : undefined}
                >
                  View the evidence
                </button>

                {evidence.kind === "loading" ? (
                  <UiStatus kind="loading" heading="Opening the evidence" />
                ) : null}

                {evidence.kind === "failed" ? (
                  <UiStatus
                    kind="expired"
                    heading="The evidence could not be opened"
                    message={evidence.message}
                  />
                ) : null}

                <h3>Record a decision</h3>

                <div className="form-field">
                  <label className="form-field__label" htmlFor="reason-code">
                    Reason code
                    <span className="form-field__required"> (required)</span>
                  </label>
                  <p className="form-field__hint" id="reason-code-hint">
                    Lower-case letters, numbers and underscores, for example evidence_unreadable.
                    The agreed catalogue of codes has not been published yet.
                  </p>
                  {reasonError === null ? null : (
                    <p className="form-field__error" id="reason-code-error">
                      {reasonError}
                    </p>
                  )}
                  <input
                    className="form-field__input"
                    id="reason-code"
                    name="reason-code"
                    type="text"
                    value={reasonCode}
                    onChange={(event) => setReasonCode(event.target.value)}
                    aria-invalid={reasonError === null ? undefined : true}
                    aria-describedby={
                      reasonError === null
                        ? "reason-code-hint"
                        : "reason-code-hint reason-code-error"
                    }
                  />
                </div>

                <div className="review-console__actions">
                  <button
                    type="button"
                    className="auth-form__submit"
                    onClick={() => startDecision("approved")}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="auth-form__submit"
                    onClick={() => startDecision("rejected")}
                  >
                    Reject
                  </button>
                </div>

                {review.kind === "confirming" ||
                review.kind === "recording" ||
                (review.kind === "failed" && !review.stale) ? (
                  <section className="review-console__confirm">
                    <h3>
                      {review.decision === "approved" ? "Confirm approval" : "Confirm rejection"}
                    </h3>
                    <p>{CONSEQUENCE[review.decision]}</p>

                    {review.kind === "failed" ? (
                      <UiStatus
                        kind="error"
                        heading="The decision was not recorded"
                        message={review.message}
                      />
                    ) : null}

                    <button
                      type="button"
                      className="auth-form__submit"
                      onClick={() => confirmDecision(selected, review.decision)}
                      aria-disabled={recording ? true : undefined}
                    >
                      {review.decision === "approved" ? "Confirm approval" : "Confirm rejection"}
                    </button>

                    {recording ? (
                      <UiStatus kind="loading" heading="Recording your decision" />
                    ) : null}
                  </section>
                ) : null}

                {review.kind === "failed" && review.stale ? (
                  <UiStatus
                    kind="expired"
                    heading="This request has already been decided"
                    message={review.message}
                    action={<Link href="/console">Refresh the queue</Link>}
                  />
                ) : null}
              </>
            )}
          </section>
        </div>
      )}

      {evidence.kind === "open" ? (
        <div
          className="evidence-viewer"
          role="dialog"
          aria-modal="true"
          aria-label={`Evidence for ${selected?.applicantDisplayName ?? "this request"}`}
          tabIndex={-1}
          ref={dialogRef}
        >
          <div className="evidence-viewer__bar">
            <p>
              This link stops working at {formatTime(evidence.expiresAt)} UTC. Reopen the evidence
              if you need longer.
            </p>
            <button type="button" className="auth-form__submit" onClick={closeEvidence}>
              Close
            </button>
          </div>

          {/*
           * Rendered in place rather than opened in a tab: a new tab puts the
           * signed URL in the address bar, in history, and in anything syncing
           * that history.
           */}
          <iframe className="evidence-viewer__frame" src={evidence.signedUrl} title="Evidence" />

          <p className="evidence-viewer__fallback">
            If the document does not display, it may be a format this browser cannot preview. Close
            this viewer and record a reason code describing what you could not read, rather than
            deciding on a document you have not seen.
          </p>
        </div>
      ) : null}
    </div>
  );
}
