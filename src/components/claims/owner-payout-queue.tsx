"use client";

import { useState } from "react";
import type { PayoutMethod, PayoutTaskView } from "@/contracts/payouts";

export interface OwnerPayoutQueueProps {
  tasks: readonly PayoutTaskView[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onCompletePayout?: (
    taskId: string,
    payload: {
      externalReference: string;
      payoutMethod: PayoutMethod;
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

export function OwnerPayoutQueue({
  tasks,
  isLoading = false,
  onRefresh,
  onCompletePayout,
}: OwnerPayoutQueueProps) {
  const [selectedTask, setSelectedTask] = useState<PayoutTaskView | null>(null);
  const [externalReference, setExternalReference] = useState("");
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>("duitnow");
  const [evidenceNotes, setEvidenceNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const pendingTasks = tasks.filter((t) => t.status === "pending");

  const totalNetPendingSen = pendingTasks.reduce((sum, t) => sum + t.netPayoutSen, 0);

  const handleOpenCompleteModal = (task: PayoutTaskView) => {
    setSelectedTask(task);
    setExternalReference("");
    setPayoutMethod("duitnow");
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
      if (onCompletePayout) {
        const res = await onCompletePayout(selectedTask.id, {
          externalReference: externalReference.trim(),
          payoutMethod,
          ...(evidenceNotes.trim() ? { evidenceNotes: evidenceNotes.trim() } : {}),
        });

        if (!res.ok) {
          setFormError(res.error ?? "Failed to record payout.");
          setIsSubmitting(false);
          return;
        }
      } else {
        const res = await fetch(`/api/owner/payouts/${selectedTask.id}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            externalReference: externalReference.trim(),
            payoutMethod,
            evidenceNotes: evidenceNotes.trim() || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          setFormError(data.error ?? "Failed to complete payout.");
          setIsSubmitting(false);
          return;
        }
      }

      setSuccessMessage(
        `Payout recorded successfully for ${formatSenToRm(selectedTask.netPayoutSen)}.`,
      );
      setSelectedTask(null);
      onRefresh?.();
    } catch {
      setFormError("Network error while recording payout.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      className="panel"
      aria-labelledby="payout-queue-heading"
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
            id="payout-queue-heading"
            style={{ margin: 0, fontSize: "1.25rem", color: "var(--text-primary, #2a2118)" }}
          >
            💰 Owner Payout Queue
          </h2>
          <p
            style={{
              margin: "0.25rem 0 0 0",
              fontSize: "0.85rem",
              color: "var(--text-muted, #5e4f37)",
            }}
          >
            Manual disbursement tracking with snapshotted 10% platform fee and balanced ledger
            entries
          </p>
        </div>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <div
            data-testid="payout-summary-badge"
            style={{
              padding: "0.35rem 0.75rem",
              borderRadius: "4px",
              background: "rgba(200, 155, 60, 0.15)",
              border: "1px solid var(--state-warning, #c89b3c)",
              fontSize: "0.8rem",
              fontWeight: 700,
              color: "var(--text-primary, #2a2118)",
            }}
          >
            Pending: {pendingTasks.length} ({formatSenToRm(totalNetPendingSen)})
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
          data-testid="payout-success-alert"
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
          data-testid="payout-empty-state"
          style={{
            padding: "2rem",
            textAlign: "center",
            color: "var(--text-muted, #5e4f37)",
            background: "var(--bg-surface, #fbf3e0)",
            borderRadius: "4px",
            border: "1px dashed var(--border-default, #9c8558)",
          }}
        >
          No payout tasks recorded. Payout tasks are generated automatically when a winning claim is
          approved.
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
                <th style={{ padding: "0.6rem 0.5rem" }}>Hunter</th>
                <th style={{ padding: "0.6rem 0.5rem" }}>Gross Bounty</th>
                <th style={{ padding: "0.6rem 0.5rem" }}>Platform Fee (10%)</th>
                <th style={{ padding: "0.6rem 0.5rem" }}>Net Disbursement</th>
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
                    data-testid={`payout-row-${task.id}`}
                    style={{
                      borderBottom: "1px solid var(--border-subtle, #d3bc92)",
                    }}
                  >
                    <td style={{ padding: "0.6rem 0.5rem", fontWeight: 600 }}>
                      {task.hunterDisplayName ?? `Hunter (${task.hunterUserId.slice(0, 8)})`}
                    </td>
                    <td style={{ padding: "0.6rem 0.5rem" }}>
                      {formatSenToRm(task.grossBountySen)}
                    </td>
                    <td style={{ padding: "0.6rem 0.5rem", color: "var(--text-muted, #5e4f37)" }}>
                      - {formatSenToRm(task.platformFeeSen)}
                    </td>
                    <td
                      style={{
                        padding: "0.6rem 0.5rem",
                        fontWeight: 700,
                        color: "var(--state-success, #2e7d32)",
                      }}
                    >
                      {formatSenToRm(task.netPayoutSen)}
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
                          className="button button--primary"
                          style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
                          aria-label={`Complete payout for ${formatSenToRm(task.netPayoutSen)}`}
                        >
                          Disburse
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

      {/* MODAL: Record Payout Completion */}
      {selectedTask && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="payout-modal-title"
          data-testid="payout-completion-modal"
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
              id="payout-modal-title"
              style={{
                margin: "0 0 0.5rem 0",
                fontSize: "1.15rem",
                color: "var(--text-primary, #2a2118)",
              }}
            >
              Record External Payout
            </h3>
            <p
              style={{
                margin: "0 0 1rem 0",
                fontSize: "0.85rem",
                color: "var(--text-muted, #5e4f37)",
              }}
            >
              Hunter: <strong>{selectedTask.hunterDisplayName ?? selectedTask.hunterUserId}</strong>
              <br />
              Net Disbursement: <strong>{formatSenToRm(selectedTask.netPayoutSen)}</strong> (after
              10% fee)
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
                  htmlFor="external-reference"
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
                  id="external-reference"
                  type="text"
                  required
                  value={externalReference}
                  onChange={(e) => setExternalReference(e.target.value)}
                  placeholder="e.g. DUITNOW-20260925-8831"
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
                  htmlFor="payout-method"
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    marginBottom: "0.25rem",
                  }}
                >
                  Disbursement Method *
                </label>
                <select
                  id="payout-method"
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value as PayoutMethod)}
                  style={{
                    width: "100%",
                    padding: "0.45rem 0.6rem",
                    borderRadius: "4px",
                    border: "1px solid var(--border-default, #9c8558)",
                    fontSize: "0.85rem",
                  }}
                >
                  <option value="duitnow">DuitNow (Instant Transfer)</option>
                  <option value="bank_transfer">Interbank GIRO (IBG)</option>
                  <option value="touch_n_go">Touch &apos;n Go eWallet</option>
                  <option value="other">Other Manual Settlement</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="evidence-notes"
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
                  id="evidence-notes"
                  rows={3}
                  value={evidenceNotes}
                  onChange={(e) => setEvidenceNotes(e.target.value)}
                  placeholder="e.g. Account verified, receipt stored in accounting records."
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
                  {isSubmitting ? "Recording..." : "Confirm Payout Completion"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
