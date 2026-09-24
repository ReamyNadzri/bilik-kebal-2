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

/** The fee rate fixed when the Wanted was published, as a percentage. */
function formatFeeRate(basisPoints: number): string {
  return `${basisPoints / 100}%`;
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
          setFormError(res.error ?? "The payout could not be recorded.");
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
          setFormError(data.message || data.error || "The payout could not be recorded.");
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
      setFormError("VAULTIX could not be reached, so nothing was recorded. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="panel ops-panel" aria-labelledby="payout-queue-heading">
      <div className="ops-panel__head">
        <div>
          <h2 id="payout-queue-heading" className="ops-panel__title">
            Payout queue
          </h2>
          <p className="ops-panel__lede">
            One task per approved winning claim. Pay the Hunter outside VAULTIX, then record it
            here. The platform fee is the rate fixed when each Wanted was published.
          </p>
        </div>
        <div className="ops-panel__tools">
          <span
            data-testid="payout-summary-badge"
            className="status-stamp status-stamp--warning numeric"
          >
            Pending: {pendingTasks.length} ({formatSenToRm(totalNetPendingSen)})
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
          data-testid="payout-success-alert"
          className="ops-alert ops-alert--success"
        >
          {successMessage}
        </p>
      )}

      {tasks.length === 0 ? (
        <p data-testid="payout-empty-state" className="ops-empty">
          No payout tasks yet. A task appears here when a Sheriff approves a winning claim.
        </p>
      ) : (
        <div className="ops-table-wrap" tabIndex={0} role="region" aria-label="Payout tasks">
          <table className="ops-table">
            <thead>
              <tr>
                <th scope="col">Hunter</th>
                <th scope="col">Gross bounty</th>
                <th scope="col">Platform fee</th>
                <th scope="col">Net payout</th>
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
                  <tr key={task.id} data-testid={`payout-row-${task.id}`}>
                    <td className="ops-table__name">
                      {task.hunterDisplayName ?? `Hunter (${task.hunterUserId.slice(0, 8)})`}
                    </td>
                    <td className="numeric">{formatSenToRm(task.grossBountySen)}</td>
                    <td className="ops-table__meta">
                      <span className="numeric">- {formatSenToRm(task.platformFeeSen)}</span>{" "}
                      <span>({formatFeeRate(task.feeRateBasisPoints)})</span>
                    </td>
                    <td className="ops-table__money">{formatSenToRm(task.netPayoutSen)}</td>
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
                          aria-label={`Complete payout for ${formatSenToRm(task.netPayoutSen)}`}
                        >
                          Record payout
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
          aria-labelledby="payout-modal-title"
          data-testid="payout-completion-modal"
        >
          <div className="dialog">
            <div className="dialog__head">
              <h3 id="payout-modal-title" className="dialog__title">
                Record an external payout
              </h3>
            </div>
            <p className="ops-summary">
              Hunter: <strong>{selectedTask.hunterDisplayName ?? selectedTask.hunterUserId}</strong>
              <br />
              Net payout:{" "}
              <strong className="numeric">{formatSenToRm(selectedTask.netPayoutSen)}</strong> (after
              the {formatFeeRate(selectedTask.feeRateBasisPoints)} platform fee)
            </p>

            {formError && (
              <p role="alert" className="ops-alert ops-alert--error dialog__lede">
                {formError}
              </p>
            )}

            <form onSubmit={handleSubmit} className="ops-form">
              <div className="form-field">
                <label htmlFor="external-reference" className="form-field__label">
                  Bank / gateway reference <span className="form-field__required">(required)</span>
                </label>
                <input
                  id="external-reference"
                  className="form-field__input"
                  type="text"
                  required
                  value={externalReference}
                  onChange={(e) => setExternalReference(e.target.value)}
                  placeholder="e.g. DUITNOW-20260925-8831"
                />
              </div>

              <div className="form-field">
                <label htmlFor="payout-method" className="form-field__label">
                  Payout method <span className="form-field__required">(required)</span>
                </label>
                <select
                  id="payout-method"
                  className="select-field"
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value as PayoutMethod)}
                >
                  <option value="duitnow">DuitNow transfer</option>
                  <option value="bank_transfer">Interbank GIRO (IBG)</option>
                  <option value="touch_n_go">Touch &apos;n Go eWallet</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="form-field">
                <label htmlFor="evidence-notes" className="form-field__label">
                  Evidence or notes <span className="form-field__required">(optional)</span>
                </label>
                <textarea
                  id="evidence-notes"
                  className="form-field__input"
                  rows={3}
                  value={evidenceNotes}
                  onChange={(e) => setEvidenceNotes(e.target.value)}
                  placeholder="e.g. Account checked; receipt filed in the accounting records."
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
                  {isSubmitting ? "Recording…" : "Confirm payout completion"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
