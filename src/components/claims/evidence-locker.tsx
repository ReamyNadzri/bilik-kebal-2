"use client";

import type { ClaimLifecycle, ClaimMimeType } from "@/contracts/claims";

export interface EvidenceItem {
  id: string;
  claimId?: string;
  actionType: string;
  fileName: string;
  mimeType: ClaimMimeType | string;
  sizeBytes: number;
  uploadedAt: string;
  status?: ClaimLifecycle | "screening" | "approved" | "under_review" | "rejected";
  downloadUrl?: string;
}

export interface EvidenceLockerProps {
  evidence?: readonly EvidenceItem[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onRemoveEvidence?: (item: EvidenceItem) => void;
  title?: string;
  subtitle?: string;
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

function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType === "application/pdf") return "📄";
  if (mimeType.includes("word") || mimeType.includes("document")) return "📝";
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return "📊";
  return "📁";
}

function getStatusBadge(status?: string): {
  label: string;
  bg: string;
  color: string;
  border: string;
} {
  switch (status) {
    case "approved":
      return {
        label: "Approved",
        bg: "rgba(46, 125, 50, 0.12)",
        color: "#1b5e20",
        border: "rgba(46, 125, 50, 0.3)",
      };
    case "screening":
      return {
        label: "Screening",
        bg: "rgba(183, 151, 99, 0.15)",
        color: "#5e4f37",
        border: "rgba(183, 151, 99, 0.4)",
      };
    case "under_review":
      return {
        label: "Under Review",
        bg: "rgba(200, 155, 60, 0.15)",
        color: "#8a6100",
        border: "rgba(200, 155, 60, 0.4)",
      };
    case "needs_information":
      return {
        label: "Needs Info",
        bg: "rgba(217, 119, 6, 0.15)",
        color: "#b45309",
        border: "rgba(217, 119, 6, 0.4)",
      };
    case "rejected":
      return {
        label: "Rejected",
        bg: "rgba(183, 28, 28, 0.12)",
        color: "#b71c1c",
        border: "rgba(183, 28, 28, 0.3)",
      };
    default:
      return {
        label: status ?? "Uploaded",
        bg: "rgba(94, 79, 55, 0.1)",
        color: "#5e4f37",
        border: "rgba(94, 79, 55, 0.25)",
      };
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
}: EvidenceLockerProps) {
  return (
    <section
      className="panel"
      aria-labelledby="evidence-locker-heading"
      style={{
        borderRadius: "4px",
        padding: "1.75rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "0.5rem",
          paddingBottom: "0.75rem",
          borderBottom: "1px solid var(--border-subtle, #d3bc92)",
        }}
      >
        <div>
          <h2
            id="evidence-locker-heading"
            style={{
              margin: "0 0 0.25rem 0",
              fontSize: "1.25rem",
              color: "var(--text-primary, #2a2118)",
            }}
          >
            {title}
          </h2>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-muted, #5e4f37)" }}>
            {subtitle}
          </p>
        </div>

        <span
          className="pixel-label"
          style={{
            padding: "0.25rem 0.6rem",
            borderRadius: "3px",
            background: "var(--bg-surface, #fbf3e0)",
            border: "1px solid var(--border-subtle, #d3bc92)",
          }}
        >
          {evidence.length} {evidence.length === 1 ? "Proof Attached" : "Proofs Attached"}
        </span>
      </div>

      {/* 1. LOADING STATE */}
      {isLoading && (
        <div
          data-testid="evidence-loading-skeletons"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "1rem",
          }}
        >
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="evidence-card-skeleton"
              style={{
                border: "1px solid var(--border-subtle, #d3bc92)",
                borderRadius: "4px",
                padding: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                background: "var(--bg-surface, #fbf3e0)",
              }}
            >
              <div
                style={{
                  height: "18px",
                  width: "45%",
                  background: "var(--border-subtle, #d3bc92)",
                  borderRadius: "3px",
                }}
              />
              <div
                style={{
                  height: "16px",
                  width: "75%",
                  background: "var(--border-subtle, #d3bc92)",
                  borderRadius: "3px",
                }}
              />
              <div
                style={{
                  height: "14px",
                  width: "35%",
                  background: "var(--border-subtle, #d3bc92)",
                  borderRadius: "3px",
                }}
              />
            </div>
          ))}
        </div>
      )}

      {/* 2. ERROR STATE */}
      {!isLoading && error && (
        <div
          data-testid="evidence-error-state"
          style={{
            border: "2px solid var(--state-error, #b71c1c)",
            background: "rgba(183, 28, 28, 0.08)",
            padding: "1.5rem",
            borderRadius: "4px",
            textAlign: "center",
          }}
        >
          <p
            style={{
              color: "var(--state-error, #b71c1c)",
              fontWeight: "700",
              margin: "0 0 0.35rem 0",
            }}
          >
            Failed to Load Evidence
          </p>
          <p
            style={{
              fontSize: "0.875rem",
              color: "var(--text-muted, #5e4f37)",
              margin: "0 0 1rem 0",
            }}
          >
            {error}
          </p>
          {onRetry && (
            <button
              type="button"
              className="button button--secondary"
              onClick={onRetry}
              style={{ fontSize: "0.85rem" }}
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* 3. EMPTY STATE */}
      {!isLoading && !error && evidence.length === 0 && (
        <div
          data-testid="evidence-empty-state"
          style={{
            border: "1px dashed var(--border-default, #9c8558)",
            borderRadius: "4px",
            padding: "2.25rem 1.5rem",
            textAlign: "center",
            background: "var(--bg-surface, #fbf3e0)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: "var(--bg-canvas, #f3e6c8)",
              border: "1px solid var(--border-default, #9c8558)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.5rem",
            }}
          >
            📭
          </div>
          <p
            style={{
              fontWeight: "700",
              margin: "0.25rem 0 0.15rem 0",
              color: "var(--text-primary, #2a2118)",
            }}
          >
            No evidence files yet
          </p>
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--text-muted, #5e4f37)",
              margin: 0,
              maxWidth: "28rem",
            }}
          >
            Upload screenshot or document proofs above to populate the evidence locker for this
            bounty.
          </p>
        </div>
      )}

      {/* 4. POPULATED EVIDENCE CARDS */}
      {!isLoading && !error && evidence.length > 0 && (
        <div
          data-testid="evidence-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "1rem",
          }}
        >
          {evidence.map((item) => {
            const badge = getStatusBadge(item.status);
            return (
              <article
                key={item.id}
                className="evidence-card"
                style={{
                  border: "1px solid var(--border-default, #9c8558)",
                  borderRadius: "4px",
                  padding: "1rem",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  background: "var(--bg-surface, #fbf3e0)",
                  gap: "0.75rem",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "0.6rem",
                    }}
                  >
                    <span
                      className="pixel-label"
                      style={{ fontSize: "0.65rem", color: "var(--text-soft, #6b5a3f)" }}
                    >
                      {item.actionType}
                    </span>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        padding: "0.15rem 0.5rem",
                        borderRadius: "3px",
                        background: badge.bg,
                        color: badge.color,
                        border: `1px solid ${badge.border}`,
                        fontWeight: "700",
                      }}
                    >
                      {badge.label}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "0.65rem",
                    }}
                  >
                    <span style={{ fontSize: "1.4rem", lineHeight: 1 }}>
                      {getFileIcon(item.mimeType)}
                    </span>
                    <div style={{ wordBreak: "break-word" }}>
                      <p
                        style={{
                          margin: "0 0 0.15rem 0",
                          fontWeight: "700",
                          fontSize: "0.95rem",
                          color: "var(--text-primary, #2a2118)",
                        }}
                      >
                        {item.fileName}
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "0.8rem",
                          color: "var(--text-muted, #5e4f37)",
                        }}
                      >
                        {formatBytes(item.sizeBytes)}
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingTop: "0.65rem",
                    borderTop: "1px solid var(--border-subtle, #d3bc92)",
                    fontSize: "0.8rem",
                  }}
                >
                  <time
                    dateTime={item.uploadedAt}
                    style={{ color: "var(--text-soft, #6b5a3f)", fontSize: "0.75rem" }}
                  >
                    {formatDate(item.uploadedAt)}
                  </time>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    {onRemoveEvidence && item.status !== "approved" && (
                      <button
                        type="button"
                        onClick={() => onRemoveEvidence(item)}
                        className="button button--secondary"
                        style={{
                          padding: "0.2rem 0.5rem",
                          fontSize: "0.75rem",
                          color: "var(--state-error, #b71c1c)",
                          borderColor: "rgba(183, 28, 28, 0.3)",
                        }}
                        aria-label={`Remove ${item.fileName}`}
                      >
                        Remove
                      </button>
                    )}
                    {item.downloadUrl && (
                      <a
                        href={item.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="button button--secondary"
                        style={{ padding: "0.2rem 0.5rem", fontSize: "0.75rem" }}
                      >
                        Download
                      </a>
                    )}
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
