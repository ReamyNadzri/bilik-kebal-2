"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { WantedReportCode } from "@/contracts/wanted-reports";
import { formatRinggit, sen } from "@/features/marketplace/money";
import { callOperation } from "@/features/presentation/call-operation";

/**
 * The Owner's master switch on a Wanted: remove it for breaking the rules or
 * the terms, even when it holds real money. Shown to the Owner only (the page
 * asks the server); `owner_remove_wanted` refuses anyone else.
 *
 * The money is settled by the database, and this panel says how before the
 * Owner confirms: the poster forfeits their own contributions and fees, and
 * every other Backer is refunded in full through the refund queue.
 */
export function OwnerRemoveWanted({ wantedId }: { readonly wantedId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ refunds: number; forfeitedSen: number } | null>(null);

  async function remove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!confirmed || reason.trim().length < 10) return;
    setBusy(true);
    setError(null);
    const result = await callOperation<{ refunds: number; forfeitedSen: number }, WantedReportCode>(
      `/api/owner/wanted/${encodeURIComponent(wantedId)}/remove`,
      { reason },
      "REMOVAL_UNAVAILABLE",
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.message || "The Wanted could not be removed. Nothing changed.");
      return;
    }
    setDone(result.data);
    router.refresh();
  }

  if (done !== null) {
    return (
      <div className="ledger-panel owner-remove" role="status">
        <h2 className="ledger-panel__heading">Removed by the Owner</h2>
        <p className="ledger-panel__body">
          It has left the Board. {done.refunds} Backer refund{done.refunds === 1 ? "" : "s"} queued
          in full; {formatRinggit(sen(done.forfeitedSen))} forfeited by the poster.
        </p>
      </div>
    );
  }

  return (
    <div className="ledger-panel owner-remove">
      <h2 className="ledger-panel__heading">Owner</h2>
      {open ? (
        <form className="owner-remove__form" onSubmit={remove} noValidate>
          <p className="ledger-panel__body">
            Removing takes this Wanted off the Board for good. The poster forfeits the money they
            put in, with its fees. Every other Backer is refunded in full, contribution and fee,
            through the refund queue.
          </p>
          {error === null ? null : (
            <p className="form-field__error" role="alert">
              {error}
            </p>
          )}
          <div className="form-field">
            <label className="form-field__label" htmlFor="owner-remove-reason">
              Which rule or term did the poster break?
            </label>
            <textarea
              className="form-field__input"
              id="owner-remove-reason"
              rows={3}
              maxLength={1000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <label className="draft-form__choice">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            I understand the poster forfeits their money and this cannot be undone.
          </label>
          <div className="dialog__actions">
            <button
              type="button"
              className="button button--secondary"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button button--danger-outline"
              disabled={busy || !confirmed || reason.trim().length < 10}
            >
              {busy ? "Removing…" : "Remove this Wanted"}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          className="button button--danger-outline ledger-panel__action"
          onClick={() => setOpen(true)}
        >
          Remove for breaking the rules
        </button>
      )}
    </div>
  );
}
