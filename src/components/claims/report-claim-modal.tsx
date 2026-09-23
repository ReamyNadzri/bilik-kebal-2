"use client";

import { useState } from "react";
import {
  CLAIM_REPORT_CATEGORIES,
  isHighRiskReportCategory,
  type ClaimReportCategory,
} from "@/contracts/moderation";

interface ReportClaimModalProps {
  claimId: string;
  claimTitle?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (isRestricted: boolean) => void;
}

export function ReportClaimModal({
  claimId,
  claimTitle,
  isOpen,
  onClose,
  onSuccess,
}: ReportClaimModalProps) {
  const [category, setCategory] = useState<ClaimReportCategory>("wrong_file");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  if (!isOpen) return null;

  const isHighRisk = isHighRiskReportCategory(category);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (description.trim().length < 10) {
      setErrorMessage("Please provide at least 10 characters describing the issue.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/claims/${claimId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, description }),
      });

      const body = await response.json();
      if (!response.ok || !body.ok) {
        setErrorMessage(body.message ?? "Could not submit report. Please try again.");
        return;
      }

      onSuccess?.(body.data?.isRestricted ?? isHighRisk);
      onClose();
    } catch {
      setErrorMessage("Network error submitting report. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="w-full max-w-lg rounded-xl border border-stone-800 bg-stone-900 p-6 text-stone-100 shadow-2xl">
        <h3 id="report-modal-title" className="text-xl font-bold tracking-tight">
          Report Claim Submission
        </h3>
        {claimTitle ? <p className="mt-1 text-sm text-stone-400">File: {claimTitle}</p> : null}

        {isHighRisk ? (
          <div
            role="alert"
            className="mt-3 rounded-lg border border-amber-600/50 bg-amber-950/40 p-3 text-xs text-amber-200"
          >
            ⚠️ High-risk reports (personal data, malware, fraud) trigger an immediate temporary
            quarantine restriction while under investigation.
          </div>
        ) : null}

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
              htmlFor="report-category"
              className="block text-xs font-semibold uppercase tracking-wider text-stone-400"
            >
              Issue Category
            </label>
            <select
              id="report-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as ClaimReportCategory)}
              className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-800 px-3 py-2 text-sm text-stone-100 focus:border-amber-500 focus:outline-none"
            >
              {CLAIM_REPORT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.replace("_", " ").toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="report-description"
              className="block text-xs font-semibold uppercase tracking-wider text-stone-400"
            >
              Description & Evidence
            </label>
            <textarea
              id="report-description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain why this claim violates academic standards or platform guidelines (min 10 characters)..."
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
              className="rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white shadow hover:bg-red-600 disabled:opacity-50"
            >
              {isSubmitting ? "Submitting..." : "Submit Report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
