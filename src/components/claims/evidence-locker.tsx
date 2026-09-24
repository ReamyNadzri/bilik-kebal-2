"use client";

import { useState } from "react";
import type { ClaimLifecycle, ClaimMimeType } from "@/contracts/claims";
import { DispatchAlertBanner } from "./dispatch-alert-banner";

export interface EvidenceItem {
  id: string;
  claimId?: string;
  actionType: string;
  fileName: string;
  mimeType: ClaimMimeType | string;
  sizeBytes: number;
  uploadedAt: string;
  status?: ClaimLifecycle | "screening" | "approved" | "under_review" | "rejected" | "restricted";
  downloadUrl?: string;
  reviewerNote?: string | null;
  isRestricted?: boolean;
  isRevoked?: boolean;
}

export interface EvidenceLockerProps {
  evidence?: readonly EvidenceItem[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onRemoveEvidence?: (item: EvidenceItem) => void;
  title?: string;
  subtitle?: string;
  activeStatusAlert?:
    ClaimLifecycle | "screening" | "approved" | "under_review" | "rejected" | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-MY", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

/** A short, readable file-type tag instead of an emoji a screen reader names. */
function getFileTypeLabel(mimeType: string, fileName: string): string {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.startsWith("image/")) return "Image";
  if (mimeType.includes("word") || mimeType.includes("document")) return "DOC";
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return "Sheet";
  if (mimeType.includes("presentation")) return "Slides";
  const extension = fileName.split(".").pop();
  return extension && extension !== fileName ? extension.toUpperCase() : "File";
}

type StampTone = "neutral" | "muted" | "info" | "success" | "warning" | "danger";

/** Status as a stamp: a word plus a token tone, never colour alone. */
function getStatusBadge(
  status?: string,
  isRevoked?: boolean,
  isRestricted?: boolean,
): { label: string; tone: StampTone } {
  if (isRevoked) return { label: "Revoked", tone: "danger" };
  if (isRestricted || status === "restricted") return { label: "Restricted", tone: "danger" };
  switch (status) {
    case "approved":
      return { label: "Approved", tone: "success" };
    case "screening":
    case "uploading":
      return { label: "Screening", tone: "neutral" };
    case "under_review":
      return { label: "Under Review", tone: "info" };
    case "needs_information":
      return { label: "Needs Info", tone: "warning" };
    case "not_selected":
      return { label: "Not Selected", tone: "muted" };
    case "rejected":
      return { label: "Rejected", tone: "danger" };
    case "withdrawn":
      return { label: "Withdrawn", tone: "muted" };
    default:
      return { label: status ?? "Uploaded", tone: "neutral" };
  }
}

function getPipelineProgress(status?: string): {
  readonly currentStep: number;
  readonly steps: readonly string[];
} {
  const steps = ["Quarantine", "Screening", "Review", "Decision"];
  switch (status) {
    case "uploading":
      return { currentStep: 1, steps };
    case "screening":
      return { currentStep: 2, steps };
    case "under_review":
    case "needs_information":
      return { currentStep: 3, steps };
    case "approved":
    case "not_selected":
    case "rejected":
    case "withdrawn":
      return { currentStep: 4, steps };
    default:
      return { currentStep: 1, steps };
  }
}

export function EvidenceLocker({
  evidence = [],
  isLoading = false,
  error = null,
  onRetry,
  onRemoveEvidence,
  title = "Evidence Locker",
  subtitle = "Attached proof files, screenshots, and review records",
  activeStatusAlert,
}: EvidenceLockerProps) {
  // Determine primary dispatch alert status: explicit prop takes precedence, then newest item
  const resolvedAlertStatus =
    activeStatusAlert ?? (evidence.length > 0 ? evidence[0]?.status : null);
  const primaryReviewerNote = evidence.length > 0 ? evidence[0]?.reviewerNote : null;

  const [downloadingClaimId, setDownloadingClaimId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownload = async (item: EvidenceItem) => {
    if (item.downloadUrl) {
      window.open(item.downloadUrl, "_blank", "noopener,noreferrer");
      return;
    }
    const targetId = item.claimId ?? item.id;
    if (!targetId) return;

    setDownloadingClaimId(targetId);
    setDownloadError(null);
    try {
      const res = await fetch(`/api/claims/${encodeURIComponent(targetId)}/download`);
      const data = await res.json();
      if (res.ok && data.ok && data.data?.downloadUrl) {
        window.open(data.data.downloadUrl, "_blank", "noopener,noreferrer");
      } else {
        setDownloadError(
          data.message ||
            data.error ||
            "This download is not available. Access may be restricted or revoked.",
        );
      }
    } catch {
      setDownloadError("VAULTIX could not be reached to prepare the download. Try again.");
    } finally {
      setDownloadingClaimId(null);
    }
  };

  return (
    <section className="panel ops-panel" aria-labelledby="evidence-locker-heading">
      {downloadError && (
        <div
          role="alert"
          data-testid="evidence-download-error"
          className="ops-alert ops-alert--error ops-alert__row"
        >
          <span>{downloadError}</span>
          <button
            type="button"
            className="button button--quiet button--compact"
            onClick={() => setDownloadError(null)}
            aria-label="Dismiss download error"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      )}
      <div className="ops-panel__head">
        <div>
          <h2 id="evidence-locker-heading" className="ops-panel__title">
            {title}
          </h2>
          <p className="ops-panel__lede">{subtitle}</p>
        </div>

        <span className="status-stamp status-stamp--neutral">
          {evidence.length} {evidence.length === 1 ? "Proof Attached" : "Proofs Attached"}
        </span>
      </div>

      {!isLoading && !error && resolvedAlertStatus && (
        <DispatchAlertBanner status={resolvedAlertStatus} reviewerNote={primaryReviewerNote} />
      )}

      {isLoading && (
        <div
          data-testid="evidence-loading-skeletons"
          className="locker__grid"
          role="status"
          aria-label="Loading evidence"
        >
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton-card" aria-hidden="true">
              <div className="skeleton-line skeleton-line--mid" />
              <div className="skeleton-line skeleton-line--long" />
              <div className="skeleton-line skeleton-line--short" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && error && (
        <div data-testid="evidence-error-state" className="ops-empty ops-empty--error" role="alert">
          <p className="ops-empty__title">Evidence could not be loaded</p>
          <p className="ops-empty__body">{error}</p>
          {onRetry && (
            <button
              type="button"
              className="button button--secondary ops-empty__action"
              onClick={onRetry}
            >
              Retry
            </button>
          )}
        </div>
      )}

      {!isLoading && !error && evidence.length === 0 && (
        <div data-testid="evidence-empty-state" className="ops-empty">
          <p className="ops-empty__title">No evidence files yet</p>
          <p className="ops-empty__body">
            Files you submit for this bounty appear here with their review status.
          </p>
        </div>
      )}

      {!isLoading && !error && evidence.length > 0 && (
        <div data-testid="evidence-grid" className="locker__grid">
          {evidence.map((item) => {
            const badge = getStatusBadge(item.status, item.isRevoked, item.isRestricted);
            const pipeline = getPipelineProgress(item.status);
            const busy = downloadingClaimId === (item.claimId ?? item.id);

            return (
              <article key={item.id} className="locker-card">
                <div>
                  <div className="locker-card__top">
                    <span className="pixel-label">{item.actionType}</span>
                    <span
                      data-testid={`badge-${item.id}`}
                      className={`status-stamp status-stamp--${badge.tone}`}
                    >
                      {badge.label}
                    </span>
                  </div>

                  <div className="locker-card__file">
                    <span className="locker-card__type">
                      {getFileTypeLabel(item.mimeType, item.fileName)}
                    </span>
                    <div>
                      <p className="locker-card__name">{item.fileName}</p>
                      <p className="locker-card__size">{formatBytes(item.sizeBytes)}</p>
                    </div>
                  </div>

                  <ol
                    data-testid={`pipeline-${item.id}`}
                    className="locker-pipeline"
                    aria-label={`Review stage: ${pipeline.steps[pipeline.currentStep - 1]}`}
                  >
                    {pipeline.steps.map((stepName, idx) => {
                      const stepNum = idx + 1;
                      const isCurrent = stepNum === pipeline.currentStep;
                      const isDone = stepNum < pipeline.currentStep;
                      return (
                        <li
                          key={stepName}
                          className={
                            isCurrent
                              ? "locker-pipeline__current"
                              : isDone
                                ? "locker-pipeline__done"
                                : undefined
                          }
                          aria-current={isCurrent ? "step" : undefined}
                        >
                          {isDone ? "✓" : `${stepNum}.`} {stepName}
                        </li>
                      );
                    })}
                  </ol>

                  {item.reviewerNote && (
                    <p data-testid={`reviewer-note-${item.id}`} className="locker-card__note">
                      <strong>Reviewer Note: </strong>
                      {item.reviewerNote}
                    </p>
                  )}
                </div>

                <div className="locker-card__foot">
                  <time dateTime={item.uploadedAt} className="locker-card__date">
                    {formatDate(item.uploadedAt)}
                  </time>
                  <div className="locker-card__actions">
                    {onRemoveEvidence && item.status !== "approved" && (
                      <button
                        type="button"
                        onClick={() => onRemoveEvidence(item)}
                        className="button button--danger-outline button--compact"
                        aria-label={`Remove ${item.fileName}`}
                      >
                        Remove
                      </button>
                    )}
                    {item.isRevoked ? (
                      <span
                        data-testid={`revoked-notice-${item.id}`}
                        className="locker-card__blocked"
                      >
                        Access Revoked
                      </span>
                    ) : item.isRestricted ? (
                      <span
                        data-testid={`restricted-notice-${item.id}`}
                        className="locker-card__blocked"
                      >
                        Restricted
                      </span>
                    ) : item.downloadUrl ? (
                      <a
                        href={item.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="button button--secondary button--compact"
                      >
                        Download
                      </a>
                    ) : item.claimId || item.status === "approved" ? (
                      <button
                        type="button"
                        onClick={() => handleDownload(item)}
                        disabled={busy}
                        className="button button--secondary button--compact"
                        aria-label={`Download ${item.fileName}`}
                      >
                        {busy ? "Preparing…" : "Download"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
