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
      className="dialog-backdrop"
    >
      <div className="dialog">
        <h3 id="report-modal-title" className="dialog__title dialog__lede">
          Report Claim Submission
        </h3>
        {claimTitle ? <p className="dialog__note">File: {claimTitle}</p> : null}

        {isHighRisk ? (
          <div role="alert" className="ops-alert ops-alert--warning dialog__lede">
            High-risk reports (personal data, malware, fraud) trigger an immediate temporary
            quarantine restriction while under investigation.
          </div>
        ) : null}

        {errorMessage ? (
          <div role="alert" className="ops-alert ops-alert--error dialog__lede">
            {errorMessage}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="ops-form">
          <div className="form-field">
            <label htmlFor="report-category" className="form-field__label">
              Issue Category
            </label>
            <select
              id="report-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as ClaimReportCategory)}
              className="select-field"
            >
              {CLAIM_REPORT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.replace("_", " ").toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="report-description" className="form-field__label">
              Description & Evidence
            </label>
            <textarea
              id="report-description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain why this claim violates academic standards or platform guidelines (min 10 characters)..."
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
              {isSubmitting ? "Submitting..." : "Submit Report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
