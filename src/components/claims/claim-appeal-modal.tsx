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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="w-full max-w-lg rounded-xl border border-stone-800 bg-stone-900 p-6 text-stone-100 shadow-2xl">
        <h3 id="appeal-modal-title" className="text-xl font-bold tracking-tight">
          Appeal Claim Decision
        </h3>
        {claimTitle ? <p className="mt-1 text-sm text-stone-400">Claim: {claimTitle}</p> : null}

        <div
          role="note"
          className="mt-3 rounded-lg border border-amber-500/40 bg-amber-950/30 p-3 text-xs text-amber-200"
        >
          <div className="font-semibold">⚠️ 7-Day Appeal Policy ({remainingDaysText})</div>
          <p className="mt-1">
            You may file <strong>only one appeal</strong> for this claim. It will be reviewed by a{" "}
            <strong>different authorized Sheriff</strong> than the one who made the initial
            decision. During an active appeal, bounty countdowns and refunds are paused.
          </p>
        </div>

        {errorMessage ? (
          <div
            role="alert"
            className="mt-3 rounded-lg border border-red-600/50 bg-red-950/40 p-3 text-xs text-red-200"
          >
            {errorMessage}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="appeal-reason"
              className="block text-xs font-semibold uppercase tracking-wider text-stone-400"
            >
              Grounds for Appeal & Justification
            </label>
            <textarea
              id="appeal-reason"
              rows={5}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="State clearly why the decision should be reconsidered (e.g., specific syllabus page references, curriculum alignment, or corrected misunderstandings)..."
              className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-800 p-3 text-sm text-stone-100 placeholder:text-stone-500 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg px-4 py-2 text-sm font-medium text-stone-400 hover:text-stone-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-stone-900 shadow hover:bg-amber-500 disabled:opacity-50"
            >
              {isSubmitting ? "Submitting Appeal..." : "Submit Formal Appeal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
