"use client";

import { useState } from "react";
import type { RefundMethod, RefundTaskView } from "@/contracts/payouts";

export interface OwnerRefundQueueProps {
  tasks: readonly RefundTaskView[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onCompleteRefund?: (
    taskId: string,
    payload: {
      externalReference: string;
      refundMethod: RefundMethod;
      evidenceNotes?: string;
    },
  ) => Promise<{ ok: boolean; error?: string }>;
}

function formatSenToRm(sen: number): string {
  return `RM ${(sen / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-MY", {
      dateStyle: "medium",
    });
  } catch {
    return iso;
  }
}

export function OwnerRefundQueue({
  tasks,
  isLoading = false,
  onRefresh,
  onCompleteRefund,
}: OwnerRefundQueueProps) {
  const [selectedTask, setSelectedTask] = useState<RefundTaskView | null>(null);
  const [externalReference, setExternalReference] = useState("");
  const [refundMethod, setRefundMethod] = useState<RefundMethod>("toyyibpay_reversal");
  const [evidenceNotes, setEvidenceNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const totalPendingSen = pendingTasks.reduce((sum, t) => sum + t.amountSen, 0);

  const handleOpenCompleteModal = (task: RefundTaskView) => {
    setSelectedTask(task);
    setExternalReference("");
    setRefundMethod("toyyibpay_reversal");
    setEvidenceNotes("");
    setFormError(null);
    setSuccessMessage(null);
  };

  const handleCloseModal = () => {
    setSelectedTask(null);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;

    if (externalReference.trim().length < 3) {
      setFormError("External reference must be at least 3 characters.");
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      if (onCompleteRefund) {
        const res = await onCompleteRefund(selectedTask.id, {
          externalReference: externalReference.trim(),
          refundMethod,
          ...(evidenceNotes.trim() ? { evidenceNotes: evidenceNotes.trim() } : {}),
        });

        if (!res.ok) {
          setFormError(res.error ?? "Failed to record refund.");
          setIsSubmitting(false);
          return;
        }
      } else {
        const res = await fetch(`/api/owner/refunds/${selectedTask.id}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            externalReference: externalReference.trim(),
            refundMethod,
            evidenceNotes: evidenceNotes.trim() || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setFormError(data.error ?? "Failed to complete refund.");
          setIsSubmitting(false);
          return;
        }
      }

      setSuccessMessage(
        `Refund of ${formatSenToRm(selectedTask.amountSen)} recorded successfully.`,
      );
      setSelectedTask(null);
      onRefresh?.();
    } catch {
      setFormError("Network error while recording refund.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      className="panel"
      aria-labelledby="refund-queue-heading"
      style={{
        borderRadius: "4px",
        padding: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
          borderBottom: "1px solid var(--border-subtle, #d3bc92)",
          paddingBottom: "0.75rem",
        }}
      >
        <div>
          <h2
            id="refund-queue-heading"
            style={{ margin: 0, fontSize: "1.25rem", color: "var(--text-primary, #2a2118)" }}
          >
            🔄 Owner Refund Queue
          </h2>
          <p
            style={{
              margin: "0.25rem 0 0 0",
              fontSize: "0.85rem",
              color: "var(--text-muted, #5e4f37)",
            }}
          >
            Individual contributor reimbursement tasks generated when unfulfilled bounties expire
          </p>
        </div>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <div
            data-testid="refund-summary-badge"
            style={{
              padding: "0.35rem 0.75rem",
              borderRadius: "4px",
              background: "rgba(183, 28, 28, 0.1)",
              border: "1px solid var(--state-error, #b71c1c)",
              fontSize: "0.8rem",
              fontWeight: 700,
              color: "var(--state-error, #b71c1c)",
            }}
          >
            Pending: {pendingTasks.length} ({formatSenToRm(totalPendingSen)})
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="button button--secondary"
              style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem" }}
            >
              {isLoading ? "Refreshing..." : "Refresh"}
            </button>
          )}
        </div>
      </div>

      {successMessage && (
        <div
          role="status"
          data-testid="refund-success-alert"
          style={{
            padding: "0.6rem 0.8rem",
            borderRadius: "4px",
            background: "rgba(46, 125, 50, 0.1)",
            border: "1px solid var(--state-success, #2e7d32)",
            color: "var(--state-success, #2e7d32)",
            fontSize: "0.85rem",
          }}
        >
          ✓ {successMessage}
        </div>
      )}

      {tasks.length === 0 ? (
        <div
          data-testid="refund-empty-state"
          style={{
            padding: "2rem",
            textAlign: "center",
            color: "var(--text-muted, #5e4f37)",
            background: "var(--bg-surface, #fbf3e0)",
            borderRadius: "4px",
            border: "1px dashed var(--border-default, #9c8558)",
          }}
        >
          No refund tasks recorded. Unfulfilled expired bounties automatically create refund tasks.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.85rem",
              textAlign: "left",
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: "2px solid var(--border-default, #9c8558)",
                  color: "var(--text-muted, #5e4f37)",
                }}
              >
                <th style={{ padding: "0.6rem 0.5rem" }}>Contributor</th>
                <th style={{ padding: "0.6rem 0.5rem" }}>Refund Amount</th>
                <th style={{ padding: "0.6rem 0.5rem" }}>Status</th>
                <th style={{ padding: "0.6rem 0.5rem" }}>Date</th>
                <th style={{ padding: "0.6rem 0.5rem", textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const isPending = task.status === "pending";
                return (
                  <tr
                    key={task.id}
                    data-testid={`refund-row-${task.id}`}
                    style={{
                      borderBottom: "1px solid var(--border-subtle, #d3bc92)",
                    }}
                  >
                    <td style={{ padding: "0.6rem 0.5rem", fontWeight: 600 }}>
                      {task.contributorDisplayName ??
                        `Contributor (${task.contributorUserId.slice(0, 8)})`}
                    </td>
                    <td
                      style={{
                        padding: "0.6rem 0.5rem",
                        fontWeight: 700,
                        color: "var(--state-error, #b71c1c)",
                      }}
                    >
                      {formatSenToRm(task.amountSen)}
                    </td>
                    <td style={{ padding: "0.6rem 0.5rem" }}>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          padding: "0.15rem 0.5rem",
                          borderRadius: "3px",
                          fontWeight: 700,
                          background: isPending
                            ? "rgba(200, 155, 60, 0.15)"
                            : "rgba(46, 125, 50, 0.12)",
                          color: isPending ? "#8a6100" : "#1b5e20",
                          border: `1px solid ${isPending ? "rgba(200, 155, 60, 0.4)" : "rgba(46, 125, 50, 0.3)"}`,
                        }}
                      >
                        {isPending ? "Pending" : "Completed"}
                      </span>
                    </td>
                    <td style={{ padding: "0.6rem 0.5rem", color: "var(--text-soft, #6b5a3f)" }}>
                      {formatDate(task.createdAt)}
                    </td>
                    <td style={{ padding: "0.6rem 0.5rem", textAlign: "right" }}>
                      {isPending ? (
                        <button
                          type="button"
                          onClick={() => handleOpenCompleteModal(task)}
                          className="button button--secondary"
                          style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
                          aria-label={`Process refund of ${formatSenToRm(task.amountSen)}`}
                        >
                          Process Refund
                        </button>
                      ) : (
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted, #5e4f37)" }}>
                          Ref: {task.externalReference ?? "N/A"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL: Record Refund Completion */}
      {selectedTask && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="refund-modal-title"
          data-testid="refund-completion-modal"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "var(--bg-surface, #fbf3e0)",
              border: "2px solid var(--border-default, #9c8558)",
              borderRadius: "6px",
              padding: "1.5rem",
              width: "100%",
              maxWidth: "480px",
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
            }}
          >
            <h3
              id="refund-modal-title"
              style={{
                margin: "0 0 0.5rem 0",
                fontSize: "1.15rem",
                color: "var(--text-primary, #2a2118)",
              }}
            >
              Record External Refund
            </h3>
            <p
              style={{
                margin: "0 0 1rem 0",
                fontSize: "0.85rem",
                color: "var(--text-muted, #5e4f37)",
              }}
            >
              Contributor:{" "}
              <strong>
                {selectedTask.contributorDisplayName ?? selectedTask.contributorUserId}
              </strong>
              <br />
              Refund Amount: <strong>{formatSenToRm(selectedTask.amountSen)}</strong>
            </p>

            {formError && (
              <div
                role="alert"
                style={{
                  padding: "0.5rem 0.75rem",
                  borderRadius: "4px",
                  background: "rgba(183, 28, 28, 0.1)",
                  border: "1px solid var(--state-error, #b71c1c)",
                  color: "var(--state-error, #b71c1c)",
                  fontSize: "0.8rem",
                  marginBottom: "1rem",
                }}
              >
                ⚠️ {formError}
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}
            >
              <div>
                <label
                  htmlFor="refund-external-reference"
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    marginBottom: "0.25rem",
                  }}
                >
                  Bank / Gateway Reference *
                </label>
                <input
                  id="refund-external-reference"
                  type="text"
                  required
                  value={externalReference}
                  onChange={(e) => setExternalReference(e.target.value)}
                  placeholder="e.g. REV-TOYYIBPAY-09283"
                  style={{
                    width: "100%",
                    padding: "0.45rem 0.6rem",
                    borderRadius: "4px",
                    border: "1px solid var(--border-default, #9c8558)",
                    fontSize: "0.85rem",
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="refund-method"
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    marginBottom: "0.25rem",
                  }}
                >
                  Refund Method *
                </label>
                <select
                  id="refund-method"
                  value={refundMethod}
                  onChange={(e) => setRefundMethod(e.target.value as RefundMethod)}
                  style={{
                    width: "100%",
                    padding: "0.45rem 0.6rem",
                    borderRadius: "4px",
                    border: "1px solid var(--border-default, #9c8558)",
                    fontSize: "0.85rem",
                  }}
                >
                  <option value="toyyibpay_reversal">ToyyibPay Gateway Reversal</option>
                  <option value="duitnow">DuitNow (Instant Transfer)</option>
                  <option value="bank_transfer">Interbank GIRO (IBG)</option>
                  <option value="touch_n_go">Touch &apos;n Go eWallet</option>
                  <option value="other">Other Settlement</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="refund-evidence-notes"
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    marginBottom: "0.25rem",
                  }}
                >
                  Evidence / Notes (optional)
                </label>
                <textarea
                  id="refund-evidence-notes"
                  rows={3}
                  value={evidenceNotes}
                  onChange={(e) => setEvidenceNotes(e.target.value)}
                  placeholder="e.g. Reversal initiated on ToyyibPay portal after bounty expired."
                  style={{
                    width: "100%",
                    padding: "0.45rem 0.6rem",
                    borderRadius: "4px",
                    border: "1px solid var(--border-default, #9c8558)",
                    fontSize: "0.85rem",
                  }}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "0.5rem",
                  marginTop: "0.5rem",
                }}
              >
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={isSubmitting}
                  className="button button--secondary"
                  style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="button button--primary"
                  style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}
                >
                  {isSubmitting ? "Recording..." : "Confirm Refund Recorded"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
