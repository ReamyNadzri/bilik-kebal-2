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
          setFormError(res.error ?? "The refund could not be recorded.");
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
          setFormError(data.message || data.error || "The refund could not be recorded.");
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
      setFormError("VAULTIX could not be reached, so nothing was recorded. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="panel ops-panel" aria-labelledby="refund-queue-heading">
      <div className="ops-panel__head">
        <div>
          <h2 id="refund-queue-heading" className="ops-panel__title">
            Refund queue
          </h2>
          <p className="ops-panel__lede">
            One task per contribution to a bounty that expired unfulfilled. Record each refund after
            you have sent it outside VAULTIX.
          </p>
        </div>
        <div className="ops-panel__tools">
          <span
            data-testid="refund-summary-badge"
            className="status-stamp status-stamp--warning numeric"
          >
            Pending: {pendingTasks.length} ({formatSenToRm(totalPendingSen)})
          </span>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="button button--secondary button--compact"
            >
              {isLoading ? "Refreshing…" : "Refresh"}
            </button>
          )}
        </div>
      </div>

      {successMessage && (
        <p
          role="status"
          data-testid="refund-success-alert"
          className="ops-alert ops-alert--success"
        >
          {successMessage}
        </p>
      )}

      {tasks.length === 0 ? (
        <p data-testid="refund-empty-state" className="ops-empty">
          No refund tasks yet. A task appears here for each contribution when a bounty expires
          unfulfilled.
        </p>
      ) : (
        <div className="ops-table-wrap" tabIndex={0} role="region" aria-label="Refund tasks">
          <table className="ops-table">
            <thead>
              <tr>
                <th scope="col">Contributor</th>
                <th scope="col">Refund amount</th>
                <th scope="col">Status</th>
                <th scope="col">Created</th>
                <th scope="col" className="ops-table__end">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const isPending = task.status === "pending";
                return (
                  <tr key={task.id} data-testid={`refund-row-${task.id}`}>
                    <td className="ops-table__name">
                      {task.contributorDisplayName ??
                        `Contributor (${task.contributorUserId.slice(0, 8)})`}
                    </td>
                    <td className="ops-table__money">{formatSenToRm(task.amountSen)}</td>
                    <td>
                      <span
                        className={`status-stamp ${isPending ? "status-stamp--warning" : "status-stamp--success"}`}
                      >
                        {isPending ? "Pending" : "Completed"}
                      </span>
                    </td>
                    <td className="ops-table__meta">{formatDate(task.createdAt)}</td>
                    <td className="ops-table__end">
                      {isPending ? (
                        <button
                          type="button"
                          onClick={() => handleOpenCompleteModal(task)}
                          className="button button--secondary button--compact"
                          aria-label={`Process refund of ${formatSenToRm(task.amountSen)}`}
                        >
                          Process refund
                        </button>
                      ) : (
                        <span className="ops-table__meta">
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

      {selectedTask && (
        <div
          className="dialog-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="refund-modal-title"
          data-testid="refund-completion-modal"
        >
          <div className="dialog">
            <div className="dialog__head">
              <h3 id="refund-modal-title" className="dialog__title">
                Record an external refund
              </h3>
            </div>
            <p className="ops-summary">
              Contributor:{" "}
              <strong>
                {selectedTask.contributorDisplayName ?? selectedTask.contributorUserId}
              </strong>
              <br />
              Refund amount:{" "}
              <strong className="numeric">{formatSenToRm(selectedTask.amountSen)}</strong>
            </p>

            {formError && (
              <p role="alert" className="ops-alert ops-alert--error dialog__lede">
                {formError}
              </p>
            )}

            <form onSubmit={handleSubmit} className="ops-form">
              <div className="form-field">
                <label htmlFor="refund-external-reference" className="form-field__label">
                  Bank / gateway reference <span className="form-field__required">(required)</span>
                </label>
                <input
                  id="refund-external-reference"
                  className="form-field__input"
                  type="text"
                  required
                  value={externalReference}
                  onChange={(e) => setExternalReference(e.target.value)}
                  placeholder="e.g. REV-TOYYIBPAY-09283"
                />
              </div>

              <div className="form-field">
                <label htmlFor="refund-method" className="form-field__label">
                  Refund method <span className="form-field__required">(required)</span>
                </label>
                <select
                  id="refund-method"
                  className="select-field"
                  value={refundMethod}
                  onChange={(e) => setRefundMethod(e.target.value as RefundMethod)}
                >
                  <option value="toyyibpay_reversal">ToyyibPay reversal</option>
                  <option value="duitnow">DuitNow transfer</option>
                  <option value="bank_transfer">Interbank GIRO (IBG)</option>
                  <option value="touch_n_go">Touch &apos;n Go eWallet</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="form-field">
                <label htmlFor="refund-evidence-notes" className="form-field__label">
                  Evidence or notes <span className="form-field__required">(optional)</span>
                </label>
                <textarea
                  id="refund-evidence-notes"
                  className="form-field__input"
                  rows={3}
                  value={evidenceNotes}
                  onChange={(e) => setEvidenceNotes(e.target.value)}
                  placeholder="e.g. Reversal made in the ToyyibPay portal after the bounty expired."
                />
              </div>

              <div className="dialog__actions">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={isSubmitting}
                  className="button button--quiet"
                >
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="button button--primary">
                  {isSubmitting ? "Recording…" : "Confirm refund recorded"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
