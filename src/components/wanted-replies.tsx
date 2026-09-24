"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Avatar } from "./avatar";
import { UiStatus } from "./ui-status";
import type { MarketplaceOperationCode, WantedReply } from "@/contracts/marketplace";
import { messageFor } from "@/features/marketplace/marketplace-messages";
import { formatPostedAge } from "@/features/marketplace/time";
import { callOperation, readOperation } from "@/features/presentation/call-operation";

export interface WantedRepliesProps {
  readonly wantedId: string;
  readonly kind: "missing_item" | "discussion";
  readonly open: boolean;
  /** Whether the viewer may reply (institution verified). */
  readonly canReply: boolean;
  /** Whether the viewer posted this Wanted, and so may mark it resolved. */
  readonly isPoster: boolean;
  readonly now: string;
}

type Load =
  | { readonly state: "loading" }
  | { readonly state: "ready"; readonly replies: readonly WantedReply[] }
  | { readonly state: "failed"; readonly message: string };

/**
 * The reply thread of a missing-item or discussion Wanted. Text only: no
 * files, no money. Replies are public to verified members, so the form reminds
 * people not to post phone numbers or addresses.
 */
export function WantedReplies({
  wantedId,
  kind,
  open,
  canReply,
  isPoster,
  now,
}: WantedRepliesProps) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resolved, setResolved] = useState(!open);
  const [version, setVersion] = useState(0);
  const path = `/api/marketplace/wanted/${encodeURIComponent(wantedId)}`;

  useEffect(() => {
    let cancelled = false;
    void readOperation<WantedReply[], MarketplaceOperationCode>(
      `${path}/replies`,
      "MARKETPLACE_UNAVAILABLE",
    ).then((result) => {
      if (cancelled) return;
      setLoad(
        result.ok
          ? { state: "ready", replies: result.data }
          : { state: "failed", message: messageFor(result.code, result.message) },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [path, version]);

  async function onReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = body.trim();
    if (text.length < 2) {
      setError("Write a reply of at least 2 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await callOperation<{ replyId: string }, MarketplaceOperationCode>(
      `${path}/replies`,
      { body: text },
      "MARKETPLACE_UNAVAILABLE",
    );
    setBusy(false);
    if (!result.ok) {
      setError(messageFor(result.code, result.message));
      return;
    }
    setBody("");
    setVersion((value) => value + 1);
  }

  async function onResolve() {
    setBusy(true);
    const result = await callOperation<{ state: "closed" }, MarketplaceOperationCode>(
      `${path}/resolve`,
      {},
      "MARKETPLACE_UNAVAILABLE",
    );
    setBusy(false);
    if (result.ok) setResolved(true);
    else setError(messageFor(result.code, result.message));
  }

  const heading = kind === "missing_item" ? "Sightings and replies" : "Replies";

  return (
    <section className="panel replies" aria-labelledby="replies-heading">
      <div className="ops-panel__head">
        <h2 id="replies-heading" className="ops-panel__title">
          {heading}
        </h2>
        {isPoster && !resolved ? (
          <button
            type="button"
            className="button button--green button--compact"
            onClick={onResolve}
            disabled={busy}
          >
            {kind === "missing_item" ? "Mark as found" : "Mark as resolved"}
          </button>
        ) : null}
      </div>

      {resolved ? (
        <p className="ops-alert ops-alert--success" role="status">
          {kind === "missing_item"
            ? "The poster marked this item as found. Thank you for helping."
            : "The poster marked this discussion as resolved."}
        </p>
      ) : null}

      {load.state === "loading" ? (
        <p className="replies__empty" role="status">
          Loading replies…
        </p>
      ) : load.state === "failed" ? (
        <UiStatus kind="offline" heading="Replies could not be loaded" message={load.message} />
      ) : load.replies.length === 0 ? (
        <p className="replies__empty">
          {kind === "missing_item" ? "No sightings yet." : "No replies yet. Start the discussion."}
        </p>
      ) : (
        <ol className="replies__list">
          {load.replies.map((reply) => (
            <li key={reply.id} className="reply">
              <Avatar src={reply.author.avatarUrl} size={36} />
              <div className="reply__body">
                <p className="reply__meta">
                  {reply.author.publicId ? (
                    <Link href={`/u/${reply.author.publicId}`}>{reply.author.displayName}</Link>
                  ) : (
                    reply.author.displayName
                  )}{" "}
                  · <time dateTime={reply.createdAt}>{formatPostedAge(reply.createdAt, now)}</time>
                </p>
                <p className="reply__text">{reply.body}</p>
              </div>
            </li>
          ))}
        </ol>
      )}

      {!resolved && canReply ? (
        <form className="ops-form" onSubmit={onReply} noValidate>
          <div className="form-field">
            <label className="form-field__label" htmlFor="reply-body">
              {kind === "missing_item" ? "Seen it? Tell the owner" : "Your reply"}
            </label>
            <p className="form-field__hint" id="reply-hint">
              Replies are visible to verified members. Do not post phone numbers or home addresses;
              arrange any handover in a public place.
            </p>
            {error ? (
              <p className="form-field__error" id="reply-error" role="alert">
                {error}
              </p>
            ) : null}
            <textarea
              className="form-field__input"
              id="reply-body"
              rows={3}
              maxLength={1000}
              value={body}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "reply-hint reply-error" : "reply-hint"}
              onChange={(event) => setBody(event.target.value)}
            />
          </div>
          <div>
            <button type="submit" className="button button--primary" disabled={busy}>
              {busy ? "Posting…" : "Post reply"}
            </button>
          </div>
        </form>
      ) : !resolved ? (
        <p className="replies__empty">
          <Link href="/profile/institution-verification">Verify your institution</Link> to reply.
        </p>
      ) : null}
    </section>
  );
}
