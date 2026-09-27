"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type {
  MarketplaceOperationCode,
  WantedChangeLock,
  WantedChangeWindow,
} from "@/contracts/marketplace";
import { formatRinggit, type Sen } from "@/features/marketplace/money";
import { callOperation } from "@/features/presentation/call-operation";
import { FormField } from "./form-field";

export interface WantedPosterControlsProps {
  readonly wantedId: string;
  readonly title: string;
  readonly description: string;
  readonly isFree: boolean;
  readonly grossBountySen: Sen;
  readonly backerCount: number;
  readonly window: WantedChangeWindow;
  /** The render's clock, so the first paint agrees with the server. */
  readonly now: string;
}

const LOCK_COPY: Readonly<Record<WantedChangeLock, string>> = {
  not_open: "Only an open Wanted can be edited or withdrawn.",
  window_closed:
    "Locked as published. Edits and withdrawal are open for the first hour after publishing only.",
  claim_submitted:
    "Locked as published. A Hunter has submitted a claim, so the request stays as they read it.",
  reply_received: "Locked as published. Someone has replied, so the request stays as they read it.",
};

function minutesLeft(until: string, now: number): number {
  return Math.max(0, Math.ceil((Date.parse(until) - now) / 60_000));
}

function clockTime(iso: string): string {
  return new Intl.DateTimeFormat("en-MY", { hour: "numeric", minute: "2-digit" }).format(
    new Date(iso),
  );
}

/**
 * The poster's own edit and withdraw controls for a published Wanted.
 *
 * Open for one hour after publishing and closed early by the first claim or
 * reply from someone else. The countdown is a courtesy: the database decides
 * under a row lock and refuses a late change, and the refusal is shown as-is.
 */
export function WantedPosterControls({
  wantedId,
  title,
  description,
  isFree,
  grossBountySen,
  backerCount,
  window: changeWindow,
  now,
}: WantedPosterControlsProps) {
  const [clock, setClock] = useState(() => Date.parse(now));
  const [dialog, setDialog] = useState<"edit" | "withdraw" | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const remaining = minutesLeft(changeWindow.editableUntil, clock);
  const lock: WantedChangeLock | null =
    changeWindow.lockedReason ?? (remaining === 0 ? "window_closed" : null);

  if (lock !== null) {
    return (
      <div className="ledger-panel poster-controls poster-controls--locked">
        <h2 className="ledger-panel__heading">Your Wanted</h2>
        <p className="ledger-panel__body">{LOCK_COPY[lock]}</p>
      </div>
    );
  }

  return (
    <div className="ledger-panel poster-controls">
      <h2 className="ledger-panel__heading">Your Wanted</h2>
      <p className="ledger-panel__body">
        You can edit the text or withdraw this request until{" "}
        <time dateTime={changeWindow.editableUntil}>{clockTime(changeWindow.editableUntil)}</time> (
        <span className="numeric">
          {remaining} {remaining === 1 ? "minute" : "minutes"}
        </span>{" "}
        left). After that, or once a claim or reply arrives, it is locked as published.
      </p>
      <div className="poster-controls__actions">
        <button
          type="button"
          className="button button--secondary"
          onClick={() => setDialog("edit")}
        >
          Edit text
        </button>
        <button
          type="button"
          className="button button--danger-outline"
          onClick={() => setDialog("withdraw")}
        >
          Withdraw
        </button>
      </div>

      {dialog === "edit" ? (
        <EditDialog
          wantedId={wantedId}
          title={title}
          description={description}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === "withdraw" ? (
        <WithdrawDialog
          wantedId={wantedId}
          isFree={isFree}
          grossBountySen={grossBountySen}
          backerCount={backerCount}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
}

function useDialogKeys(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return ref;
}

function refusalMessage(code: MarketplaceOperationCode, message: string): string {
  if (code === "WANTED_LOCKED" || code === "VALIDATION_ERROR") return message;
  if (code === "AUTH_REQUIRED") return "Your session has ended. Sign in again and retry.";
  if (code === "ACCOUNT_RESTRICTED") return "A restriction on your account blocks changes.";
  if (code === "WANTED_NOT_FOUND") return "This Wanted is no longer available to change.";
  return "Nothing was changed. Check your connection and try again.";
}

function EditDialog({
  wantedId,
  title: initialTitle,
  description: initialDescription,
  onClose,
}: {
  readonly wantedId: string;
  readonly title: string;
  readonly description: string;
  readonly onClose: () => void;
}) {
  const router = useRouter();
  const ref = useDialogKeys(onClose);
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleLength = title.trim().length;
  const descriptionLength = description.trim().length;
  const titleError = titleLength < 8 || titleLength > 120 ? "Use 8 to 120 characters." : undefined;
  const descriptionError =
    descriptionLength < 20 || descriptionLength > 2000 ? "Use 20 to 2000 characters." : undefined;

  async function save(event: FormEvent) {
    event.preventDefault();
    if (titleError || descriptionError) return;
    setSaving(true);
    setError(null);
    const result = await callOperation<{ state: "edited" }, MarketplaceOperationCode>(
      `/api/marketplace/wanted/${encodeURIComponent(wantedId)}`,
      { title, description },
      "MARKETPLACE_UNAVAILABLE",
      "PATCH",
    );
    setSaving(false);
    if (result.ok) {
      onClose();
      router.refresh();
      return;
    }
    setError(refusalMessage(result.code, result.message));
  }

  return (
    <div
      className="dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-wanted-title"
      ref={ref}
      tabIndex={-1}
    >
      <form className="dialog dialog--wide" onSubmit={(event) => void save(event)} noValidate>
        <div className="dialog__head">
          <h2 id="edit-wanted-title" className="dialog__title">
            Edit your Wanted
          </h2>
          <button
            type="button"
            className="button button--quiet dialog__close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <p className="dialog__note">
          Only the title and description can change. The bounty, duration, course and fee stay as
          published. The previous text is kept on record.
        </p>
        {error ? (
          <p className="form-field__error" role="alert">
            {error}
          </p>
        ) : null}
        <FormField
          id="edit-wanted-title-input"
          label="Title"
          required
          value={title}
          maxLength={120}
          onChange={(event) => setTitle(event.target.value)}
          hint="8 to 120 characters."
          error={titleError}
        />
        <div className="form-field">
          <label className="form-field__label" htmlFor="edit-wanted-description">
            Description<span className="form-field__required"> (required)</span>
          </label>
          <p className="form-field__hint" id="edit-wanted-description-hint">
            20 to 2000 characters.
          </p>
          {descriptionError ? (
            <p className="form-field__error" id="edit-wanted-description-error">
              {descriptionError}
            </p>
          ) : null}
          <textarea
            className="form-field__input draft-form__textarea"
            id="edit-wanted-description"
            rows={6}
            required
            maxLength={2000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            aria-invalid={descriptionError ? true : undefined}
            aria-describedby={
              descriptionError
                ? "edit-wanted-description-hint edit-wanted-description-error"
                : "edit-wanted-description-hint"
            }
          />
        </div>
        <div className="dialog__actions">
          <button type="button" className="button button--quiet" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="button button--primary"
            disabled={saving || titleError !== undefined || descriptionError !== undefined}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

function WithdrawDialog({
  wantedId,
  isFree,
  grossBountySen,
  backerCount,
  onClose,
}: {
  readonly wantedId: string;
  readonly isFree: boolean;
  readonly grossBountySen: Sen;
  readonly backerCount: number;
  readonly onClose: () => void;
}) {
  const router = useRouter();
  const ref = useDialogKeys(onClose);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paid = !isFree && grossBountySen > 0;

  async function withdraw() {
    setBusy(true);
    setError(null);
    const result = await callOperation<
      { state: "withdrawn"; refundsQueued: number },
      MarketplaceOperationCode
    >(
      `/api/marketplace/wanted/${encodeURIComponent(wantedId)}/withdraw`,
      {},
      "MARKETPLACE_UNAVAILABLE",
    );
    if (result.ok) {
      router.replace("/profile?withdrawn=1");
      return;
    }
    setBusy(false);
    setError(refusalMessage(result.code, result.message));
  }

  return (
    <div
      className="dialog-backdrop"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="withdraw-wanted-title"
      aria-describedby="withdraw-wanted-consequences"
      ref={ref}
      tabIndex={-1}
    >
      <div className="dialog">
        <div className="dialog__head">
          <h2 id="withdraw-wanted-title" className="dialog__title">
            Withdraw this Wanted?
          </h2>
          <button
            type="button"
            className="button button--quiet dialog__close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <div id="withdraw-wanted-consequences">
          <p className="dialog__lede">
            It leaves the Board at once and cannot be reopened. Hunters can no longer claim it.
          </p>
          {paid ? (
            <p className="dialog__note">
              Refund: the full bounty of{" "}
              <strong className="numeric">{formatRinggit(grossBountySen)}</strong> from{" "}
              {backerCount} {backerCount === 1 ? "Backer" : "Backers"}, your own contribution
              included, goes to the refund queue. The platform refunds each contribution in full, by
              hand; it is not instant. No platform fee is taken. The payment provider&rsquo;s own
              checkout charge was never part of the bounty and is not included in this refund.
            </p>
          ) : (
            <p className="dialog__note">
              No money is involved. {isFree ? "The free request it used is not returned." : ""}
            </p>
          )}
        </div>
        {error ? (
          <p className="form-field__error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="dialog__actions">
          <button type="button" className="button button--quiet" onClick={onClose} disabled={busy}>
            Keep it
          </button>
          <button
            type="button"
            className="button button--danger-outline"
            onClick={() => void withdraw()}
            disabled={busy}
          >
            {busy ? "Withdrawing…" : "Withdraw this Wanted"}
          </button>
        </div>
      </div>
    </div>
  );
}
