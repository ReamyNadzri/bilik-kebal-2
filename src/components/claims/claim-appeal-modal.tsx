"use client";

import { useState } from "react";

interface ClaimAppealModalProps {
  claimId: string;
  claimTitle?: string;
  reviewDate?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (appealId: string) => void;
}

export function ClaimAppealModal({
  claimId,
  claimTitle,
  reviewDate,
  isOpen,
  onClose,
  onSuccess,
}: ClaimAppealModalProps) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [now] = useState(() => Date.now());

  if (!isOpen) return null;

  let remainingDaysText = "7 days";
  if (reviewDate) {
    const deadline = new Date(new Date(reviewDate).getTime() + 7 * 24 * 60 * 60 * 1000);
    const msLeft = deadline.getTime() - now;
    const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
    remainingDaysText = `${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 10) {
      setErrorMessage(
        "Please provide at least 10 characters explaining your appeal justification.",
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/claims/${claimId}/appeal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });

      const body = await response.json();
      if (!response.ok || !body.ok) {
        setErrorMessage(body.message ?? "Could not submit appeal. Please try again.");
        return;
      }

      onSuccess?.(body.data?.appealId ?? "");
      onClose();
    } catch {
      setErrorMessage("Network error submitting appeal. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="appeal-modal-title"
      className="dialog-backdrop"
    >
      <div className="dialog">
        <h3 id="appeal-modal-title" className="dialog__title dialog__lede">
          Appeal Claim Decision
        </h3>
        {claimTitle ? <p className="dialog__note">Claim: {claimTitle}</p> : null}

        <div role="note" className="ops-alert ops-alert--warning dialog__lede">
          <div className="upload-card__heading">7-Day Appeal Policy ({remainingDaysText})</div>
          <p>
            You may file <strong>only one appeal</strong> for this claim. It will be reviewed by a{" "}
            <strong>different authorized Sheriff</strong> than the one who made the initial
            decision. During an active appeal, bounty countdowns and refunds are paused.
          </p>
        </div>

        {errorMessage ? (
          <div role="alert" className="ops-alert ops-alert--error dialog__lede">
            {errorMessage}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="ops-form">
          <div className="form-field">
            <label htmlFor="appeal-reason" className="form-field__label">
              Grounds for Appeal & Justification
            </label>
            <textarea
              id="appeal-reason"
              rows={5}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="State clearly why the decision should be reconsidered (e.g., specific syllabus page references, curriculum alignment, or corrected misunderstandings)..."
              className="form-field__input"
            />
          </div>

          <div className="dialog__actions">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="button button--quiet"
            >
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="button button--primary">
              {isSubmitting ? "Submitting Appeal..." : "Submit Formal Appeal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
