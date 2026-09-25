"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { WantedPicturePicker } from "./wanted-picture-picker";
import type { WantedPicture, WantedPictureCode } from "@/contracts/wanted-pictures";
import { callOperation } from "@/features/presentation/call-operation";
import {
  AUTO_PICTURE,
  saveWantedPicture,
  type WantedPictureChoice,
} from "@/features/presentation/wanted-picture-choice";

export interface WantedPictureControlsProps {
  /** The Wanted's public id. */
  readonly wantedId: string;
  readonly picture: WantedPicture | null;
  readonly kind: "academic" | "missing_item" | "discussion";
  readonly resourceType: string;
  readonly isPoster: boolean;
  /** Console access. The database decides whether it covers this Wanted. */
  readonly canModerate: boolean;
}

const REASON = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

function initialChoice(picture: WantedPicture | null): WantedPictureChoice {
  return picture?.kind === "preset" ? { kind: "preset", preset: picture.preset } : AUTO_PICTURE;
}

/**
 * Below the poster on a Wanted's page: the poster changes its picture; a
 * Sheriff for the Wanted, or the Owner, removes a picture with a reason code.
 * Both are re-authorised in the database. Mounted only for the poster, or for
 * console staff when there is a picture to remove.
 */
export function WantedPictureControls({
  wantedId,
  picture,
  kind,
  resourceType,
  isPoster,
  canModerate,
}: WantedPictureControlsProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [choice, setChoice] = useState<WantedPictureChoice>(() => initialChoice(picture));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setMessage(null);
    const result = await saveWantedPicture(wantedId, choice);
    setBusy(false);
    if (!result.ok) {
      setMessage({ kind: "error", text: result.message || "The picture was not saved." });
      return;
    }
    setEditing(false);
    setMessage({ kind: "ok", text: "Picture saved." });
    router.refresh();
  }

  async function remove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!REASON.test(reason.trim())) {
      setMessage({
        kind: "error",
        text: "Enter a reason code: lower-case letters, numbers and underscores.",
      });
      return;
    }
    setBusy(true);
    setMessage(null);
    const result = await callOperation<{ done: true }, WantedPictureCode>(
      `/api/marketplace/wanted/${encodeURIComponent(wantedId)}/picture/remove`,
      { reasonCode: reason.trim() },
      "PICTURE_UNAVAILABLE",
    );
    setBusy(false);
    if (!result.ok) {
      setMessage({ kind: "error", text: result.message || "The picture was not removed." });
      return;
    }
    setReason("");
    setMessage({ kind: "ok", text: "Picture removed. The poster shows its automatic drawing." });
    router.refresh();
  }

  return (
    <div className="ledger-panel picture-controls">
      <h2 className="ledger-panel__heading">Picture</h2>
      {message ? (
        <p
          className={`ops-alert ${message.kind === "ok" ? "ops-alert--success" : "ops-alert--error"}`}
          role={message.kind === "ok" ? "status" : "alert"}
        >
          {message.text}
        </p>
      ) : null}

      {isPoster ? (
        editing ? (
          <>
            <WantedPicturePicker
              value={choice}
              onChange={setChoice}
              kind={kind}
              resourceType={resourceType}
              disabled={busy}
            />
            <div className="dialog__actions">
              <button
                type="button"
                className="button button--quiet button--compact"
                disabled={busy}
                onClick={() => {
                  setEditing(false);
                  setChoice(initialChoice(picture));
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button--primary button--compact"
                disabled={busy}
                onClick={() => void save()}
              >
                {busy ? "Saving…" : "Save picture"}
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            className="button button--secondary button--compact"
            onClick={() => {
              setMessage(null);
              setEditing(true);
            }}
          >
            Change picture
          </button>
        )
      ) : canModerate && picture !== null ? (
        <form className="ops-form" onSubmit={(event) => void remove(event)} noValidate>
          <p className="form-field__hint">
            Remove a picture that breaks the rules. The poster&rsquo;s upload is kept for review.
          </p>
          <div className="form-field">
            <label className="form-field__label" htmlFor="picture-remove-reason">
              Reason code
            </label>
            <input
              className="form-field__input"
              id="picture-remove-reason"
              value={reason}
              placeholder="offensive_image"
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <div>
            <button
              type="submit"
              className="button button--danger-outline button--compact"
              disabled={busy}
            >
              Remove picture
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
