"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Avatar } from "./avatar";
import { MemberBadgeMark } from "./member-badge-mark";
import { UiStatus } from "./ui-status";
import {
  REPLY_EDIT_WINDOW_MINUTES,
  type MarketplaceOperationCode,
  type WantedReply,
  type WantedThreadState,
} from "@/contracts/marketplace";
import { messageFor } from "@/features/marketplace/marketplace-messages";
import { formatPostedAge, formatVanishesIn } from "@/features/marketplace/time";
import { callOperation, readOperation } from "@/features/presentation/call-operation";

export interface WantedRepliesProps {
  readonly wantedId: string;
  readonly kind: "missing_item" | "discussion" | "academic";
  readonly open: boolean;
  /** Whether the viewer may reply (institution verified). */
  readonly canReply: boolean;
  /** Whether the viewer posted this Wanted, and so may mark it resolved. */
  readonly isPoster: boolean;
  readonly now: string;
  /** The bounty in sen; 0 on a free request, which has nothing to release. */
  readonly bountySen?: number;
  /** A bounty release is already waiting for a Sheriff. */
  readonly releasePending?: boolean;
  /** Retention of this thread; absent in fixtures. */
  readonly thread?: WantedThreadState;
  /** The viewer's public id, to offer edit and delete on their own messages. */
  readonly viewerPublicId?: string | null;
  /**
   * Whether to offer "Hide" (Sheriffs and the Owner). A courtesy only: the
   * database decides who may hide a message.
   */
  readonly canModerate?: boolean;
}

/** How often an open thread checks for new messages while the tab is visible. */
export const REPLY_REFRESH_MS = 15_000;

type Load =
  | { readonly state: "loading" }
  | { readonly state: "ready"; readonly replies: readonly WantedReply[] }
  | { readonly state: "failed"; readonly message: string };

/**
 * The chat thread of a Wanted: sightings on a missing item, replies on a
 * discussion, questions on an academic bounty. Text only: no files, no money.
 * Messages are public to verified members, so the form reminds people not to
 * post phone numbers or addresses; academic questions also refuse links, so a
 * resource cannot change hands outside a reviewed Claim (enforced in the
 * database, not here).
 *
 * An open thread refreshes every 15 seconds while the tab is visible. A
 * closed thread is kept for 7 days and then deleted; the notice says when.
 */
export function WantedReplies({
  wantedId,
  kind,
  open,
  canReply,
  isPoster,
  now,
  bountySen = 0,
  releasePending = false,
  thread,
  viewerPublicId = null,
  canModerate = false,
}: WantedRepliesProps) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resolved, setResolved] = useState(!open);
  const [version, setVersion] = useState(0);
  const [tick, setTick] = useState(0);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [resolvedHere, setResolvedHere] = useState(false);
  const [replyingTo, setReplyingTo] = useState<WantedReply | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [finder, setFinder] = useState("");
  const [releaseNote, setReleaseNote] = useState("");
  const [releaseState, setReleaseState] = useState<"idle" | "sent">(
    releasePending ? "sent" : "idle",
  );
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const path = `/api/marketplace/wanted/${encodeURIComponent(wantedId)}`;

  useEffect(() => {
    let cancelled = false;
    void readOperation<WantedReply[], MarketplaceOperationCode>(
      `${path}/replies`,
      "MARKETPLACE_UNAVAILABLE",
    ).then((result) => {
      if (cancelled) return;
      setRefreshFailed(!result.ok);
      // A failed background refresh keeps the messages already on screen.
      setLoad((current) =>
        result.ok
          ? { state: "ready", replies: result.data }
          : current.state === "ready"
            ? current
            : { state: "failed", message: messageFor(result.code, result.message) },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [path, version, tick]);

  useEffect(() => {
    if (resolved) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") setTick((value) => value + 1);
    }, REPLY_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [resolved]);

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
      { body: text, ...(replyingTo ? { parentId: replyingTo.id } : {}) },
      "MARKETPLACE_UNAVAILABLE",
    );
    setBusy(false);
    if (!result.ok) {
      setError(messageFor(result.code, result.message));
      return;
    }
    setBody("");
    setReplyingTo(null);
    setVersion((value) => value + 1);
  }

  function startReplyTo(reply: WantedReply) {
    setReplyingTo(reply);
    bodyRef.current?.focus();
  }

  async function onResolve() {
    setBusy(true);
    const result = await callOperation<{ state: "closed" }, MarketplaceOperationCode>(
      `${path}/resolve`,
      {},
      "MARKETPLACE_UNAVAILABLE",
    );
    setBusy(false);
    if (result.ok) {
      setResolved(true);
      setResolvedHere(true);
    } else setError(messageFor(result.code, result.message));
  }

  async function onReopen() {
    setBusy(true);
    setError(null);
    const result = await callOperation<{ state: "open" }, MarketplaceOperationCode>(
      `${path}/reopen`,
      {},
      "MARKETPLACE_UNAVAILABLE",
    );
    setBusy(false);
    if (result.ok) {
      setResolved(false);
      setResolvedHere(false);
      setVersion((value) => value + 1);
    } else setError(messageFor(result.code, result.message));
  }

  async function onRelease(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (finder === "") {
      setReleaseError("Choose the member who helped you.");
      return;
    }
    setBusy(true);
    setReleaseError(null);
    const result = await callOperation<{ requestId: string }, MarketplaceOperationCode>(
      `${path}/payout-request`,
      { finderPublicId: finder, ...(releaseNote.trim() ? { note: releaseNote.trim() } : {}) },
      "MARKETPLACE_UNAVAILABLE",
    );
    setBusy(false);
    if (!result.ok) {
      setReleaseError(messageFor(result.code, result.message));
      return;
    }
    setReleaseState("sent");
  }

  const academic = kind === "academic";
  const heading =
    kind === "missing_item" ? "Sightings and replies" : academic ? "Questions" : "Replies";
  const canReopen =
    isPoster &&
    resolved &&
    !academic &&
    (resolvedHere ||
      (thread?.reopenUntil !== null &&
        thread?.reopenUntil !== undefined &&
        Date.parse(now) < Date.parse(thread.reopenUntil)));
  const retention = retentionNotice({
    academic,
    kind,
    resolved,
    resolvedHere,
    thread,
    now,
    paid: bountySen > 0,
  });
  // Everyone who replied, once each: the poster names one of them.
  const helpers =
    load.state === "ready"
      ? [
          ...new Map(
            load.replies
              .filter((reply) => reply.author.publicId !== "")
              .map((reply) => [reply.author.publicId, reply.author]),
          ).values(),
        ]
      : [];

  return (
    <section className="panel replies" aria-labelledby="replies-heading">
      <div className="ops-panel__head">
        <h2 id="replies-heading" className="ops-panel__title">
          {heading}
        </h2>
        {isPoster && !resolved && !academic ? (
          <button
            type="button"
            className="button button--green button--compact"
            onClick={onResolve}
            disabled={busy}
          >
            {kind === "missing_item" ? "Mark as found" : "Mark as resolved"}
          </button>
        ) : null}
        {canReopen ? (
          <button
            type="button"
            className="button button--compact"
            onClick={onReopen}
            disabled={busy}
          >
            {kind === "missing_item" ? "Not found after all? Reopen" : "Reopen discussion"}
          </button>
        ) : null}
      </div>

      {resolved && !academic ? (
        <p className="ops-alert ops-alert--success" role="status">
          {thread?.autoClosed && !resolvedHere
            ? "This request closed after 30 days without a new message."
            : kind === "missing_item"
              ? "The poster marked this item as found. Thank you for helping."
              : "The poster marked this discussion as resolved."}
        </p>
      ) : null}

      {retention ? <p className="form-field__hint">{retention}</p> : null}

      {resolved && error ? (
        <p className="form-field__error" role="alert">
          {error}
        </p>
      ) : null}

      {thread?.clearedAt ? (
        <p className="replies__empty">
          The messages in this thread were deleted 7 days after it closed.
        </p>
      ) : load.state === "loading" ? (
        <p className="replies__empty" role="status">
          Loading replies…
        </p>
      ) : load.state === "failed" ? (
        <UiStatus
          kind="offline"
          heading={academic ? "Questions could not be loaded" : "Replies could not be loaded"}
          message={load.message}
          action={
            <button
              type="button"
              className="button button--compact"
              onClick={() => {
                setLoad({ state: "loading" });
                setVersion((value) => value + 1);
              }}
            >
              Try again
            </button>
          }
        />
      ) : load.replies.length === 0 ? (
        <p className="replies__empty">
          {kind === "missing_item"
            ? "No sightings yet."
            : academic
              ? "No questions yet."
              : "No replies yet. Start the discussion."}
        </p>
      ) : (
        <ol className="replies__list">
          {load.replies.map((reply) => (
            <ReplyItem
              key={reply.id}
              reply={reply}
              now={now}
              open={!resolved}
              canReply={canReply}
              own={viewerPublicId !== null && reply.author.publicId === viewerPublicId}
              canModerate={canModerate}
              onReplyTo={startReplyTo}
              onChanged={() => setVersion((value) => value + 1)}
            />
          ))}
        </ol>
      )}

      {load.state === "ready" && refreshFailed && !resolved ? (
        <p className="replies__empty" role="status">
          New messages could not be checked. Retrying in a few seconds.
        </p>
      ) : null}

      {isPoster && bountySen > 0 && !academic ? (
        releaseState === "sent" ? (
          <p className="ops-alert ops-alert--info" role="status">
            A Sheriff is reviewing your bounty release. You will be notified when it is decided.
          </p>
        ) : (
          <form className="ops-form release-form" onSubmit={onRelease} noValidate>
            <h3 className="ops-panel__title">Release the bounty</h3>
            <p className="form-field__hint">
              {kind === "missing_item"
                ? "Found it? Name the member who helped."
                : "Name the member whose reply helped."}{" "}
              A Sheriff checks it before anyone is paid, and the Owner records the payout.
            </p>
            {releaseError ? (
              <p className="form-field__error" role="alert">
                {releaseError}
              </p>
            ) : null}
            {helpers.length === 0 ? (
              <p className="replies__empty">
                The member who helped needs to reply here first, so you can name them.
              </p>
            ) : (
              <>
                <div className="form-field">
                  <label className="form-field__label" htmlFor="release-finder">
                    Who helped you?
                  </label>
                  <select
                    className="form-field__input"
                    id="release-finder"
                    value={finder}
                    onChange={(event) => setFinder(event.target.value)}
                  >
                    <option value="">Choose a member who replied</option>
                    {helpers.map((helper) => (
                      <option key={helper.publicId} value={helper.publicId}>
                        {helper.displayName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label className="form-field__label" htmlFor="release-note">
                    Note for the Sheriff <span className="form-field__required">(optional)</span>
                  </label>
                  <textarea
                    className="form-field__input"
                    id="release-note"
                    rows={2}
                    maxLength={500}
                    value={releaseNote}
                    onChange={(event) => setReleaseNote(event.target.value)}
                  />
                </div>
                <div>
                  <button type="submit" className="button button--primary" disabled={busy}>
                    Ask a Sheriff to release the bounty
                  </button>
                </div>
              </>
            )}
          </form>
        )
      ) : null}

      {!resolved && canReply ? (
        <form className="ops-form" onSubmit={onReply} noValidate>
          <div className="form-field">
            <label className="form-field__label" htmlFor="reply-body">
              {kind === "missing_item"
                ? "Seen it? Tell the owner"
                : academic
                  ? isPoster
                    ? "Reply to a question"
                    : "Ask the poster a question"
                  : "Your reply"}
            </label>
            <p className="form-field__hint" id="reply-hint">
              {academic
                ? "Questions are visible to verified members. Links, email addresses and chat handles are not allowed: send files through a Claim so a Sheriff can review them and the bounty is paid fairly."
                : "Replies are visible to verified members. Do not post phone numbers or home addresses; arrange any handover in a public place."}
            </p>
            {error ? (
              <p className="form-field__error" id="reply-error" role="alert">
                {error}
              </p>
            ) : null}
            {replyingTo ? (
              <p className="replies__replying-to">
                <span>
                  Replying to {replyingTo.author.displayName}: “{replyingTo.body.slice(0, 80)}
                  {replyingTo.body.length > 80 ? "…" : ""}”
                </span>
                <button type="button" className="reply__action" onClick={() => setReplyingTo(null)}>
                  Cancel reply
                </button>
              </p>
            ) : null}
            <textarea
              ref={bodyRef}
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
              {busy ? "Posting…" : academic ? "Post question" : "Post reply"}
            </button>
          </div>
        </form>
      ) : !resolved ? (
        <p className="replies__empty">
          <Link href="/profile/institution-verification">Verify your institution</Link> to{" "}
          {academic ? "ask a question" : "reply"}.
        </p>
      ) : null}
    </section>
  );
}

/** What happens to this thread and when, in plain words. */
function retentionNotice({
  academic,
  kind,
  resolved,
  resolvedHere,
  thread,
  now,
  paid,
}: {
  academic: boolean;
  kind: WantedRepliesProps["kind"];
  resolved: boolean;
  resolvedHere: boolean;
  thread: WantedThreadState | undefined;
  now: string;
  paid: boolean;
}): string | null {
  if (thread?.clearedAt) return null;
  if (academic) {
    if (!resolved) return "Questions are deleted 7 days after this bounty closes.";
    return thread?.vanishesAt
      ? `These questions are deleted ${formatVanishesIn(thread.vanishesAt, now)} at the earliest.`
      : "These questions are deleted 7 days after this bounty closes.";
  }
  if (!resolved) {
    return kind === "missing_item"
      ? "Once the item is marked as found, this chat stays on the Board for 7 days and is then deleted."
      : "Once this is marked as resolved, the chat stays on the Board for 7 days and is then deleted.";
  }
  if (resolvedHere || !thread?.closedAt) {
    return paid
      ? "This chat is kept until the bounty is released or refunded, then deleted 7 days later."
      : "This chat stays on the Board for 7 days and is then deleted.";
  }
  if (thread.vanishesAt) {
    return `This chat and the request leave the Board ${formatVanishesIn(thread.vanishesAt, now)}.`;
  }
  return paid
    ? "This chat is kept until the bounty is released or refunded, then deleted 7 days later."
    : null;
}

interface ReplyItemProps {
  readonly reply: WantedReply;
  readonly now: string;
  readonly open: boolean;
  readonly canReply: boolean;
  readonly own: boolean;
  readonly canModerate: boolean;
  readonly onReplyTo: (reply: WantedReply) => void;
  readonly onChanged: () => void;
}

type ItemMode = "view" | "editing" | "confirm-delete" | "hiding";

/**
 * One chat message with its actions: reply (quote), and for its author edit
 * (15 minutes, open thread) and delete; for a Sheriff or the Owner, hide with
 * a reason code. Every action is re-checked by the database.
 */
function ReplyItem({
  reply,
  now,
  open,
  canReply,
  own,
  canModerate,
  onReplyTo,
  onChanged,
}: ReplyItemProps) {
  const [mode, setMode] = useState<ItemMode>("view");
  const [draft, setDraft] = useState(reply.body);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const base = `/api/marketplace/replies/${encodeURIComponent(reply.id)}`;
  const editable =
    own &&
    open &&
    !reply.deleted &&
    Date.parse(now) - Date.parse(reply.createdAt) < REPLY_EDIT_WINDOW_MINUTES * 60_000;

  async function run(path: string, payload: unknown, method: "POST" | "PATCH" = "POST") {
    setBusy(true);
    setError(null);
    const result = await callOperation<{ state: string }, MarketplaceOperationCode>(
      path,
      payload,
      "MARKETPLACE_UNAVAILABLE",
      method,
    );
    setBusy(false);
    if (!result.ok) {
      setError(messageFor(result.code, result.message));
      return;
    }
    setMode("view");
    onChanged();
  }

  return (
    <li className="reply">
      <Avatar src={reply.author.avatarUrl} size={36} />
      <div className="reply__body">
        <p className="reply__meta">
          {reply.author.publicId ? (
            <Link href={`/u/${reply.author.publicId}`}>{reply.author.displayName}</Link>
          ) : (
            reply.author.displayName
          )}
          <MemberBadgeMark badge={reply.author.badge} /> ·{" "}
          <time dateTime={reply.createdAt}>{formatPostedAge(reply.createdAt, now)}</time>
          {reply.editedAt ? " · edited" : null}
        </p>
        {reply.parent ? (
          <blockquote className="reply__quote">
            {reply.parent.deleted
              ? `Replying to ${reply.parent.authorName}: message deleted`
              : `Replying to ${reply.parent.authorName}: “${reply.parent.excerpt}”`}
          </blockquote>
        ) : null}

        {reply.deleted ? (
          <p className="reply__text reply__text--deleted">Message deleted</p>
        ) : mode === "editing" ? (
          <form
            className="reply__inline-form"
            onSubmit={(event) => {
              event.preventDefault();
              const text = draft.trim();
              if (text.length < 2) {
                setError("Write at least 2 characters.");
                return;
              }
              void run(base, { body: text }, "PATCH");
            }}
          >
            <label className="form-field__label" htmlFor={`edit-${reply.id}`}>
              Edit your message
            </label>
            <textarea
              className="form-field__input"
              id={`edit-${reply.id}`}
              rows={3}
              maxLength={1000}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <div className="reply__actions">
              <button
                type="submit"
                className="button button--primary button--compact"
                disabled={busy}
              >
                Save
              </button>
              <button
                type="button"
                className="button button--compact"
                onClick={() => {
                  setDraft(reply.body);
                  setMode("view");
                  setError(null);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <p className="reply__text">{reply.body}</p>
        )}

        {error ? (
          <p className="form-field__error" role="alert">
            {error}
          </p>
        ) : null}

        {mode === "confirm-delete" ? (
          <div className="reply__inline-form" role="group" aria-label="Confirm delete">
            <p className="form-field__hint">
              Delete this message? Its text is erased for everyone.
            </p>
            <div className="reply__actions">
              <button
                type="button"
                className="button button--compact"
                disabled={busy}
                onClick={() => void run(`${base}/delete`, {})}
              >
                Delete message
              </button>
              <button
                type="button"
                className="button button--compact"
                onClick={() => setMode("view")}
              >
                Keep it
              </button>
            </div>
          </div>
        ) : null}

        {mode === "hiding" ? (
          <form
            className="reply__inline-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(reason.trim())) {
                setError("Enter a reason code: lower-case letters, numbers and underscores.");
                return;
              }
              void run(`${base}/hide`, { hide: true, reasonCode: reason.trim() });
            }}
          >
            <label className="form-field__label" htmlFor={`hide-${reply.id}`}>
              Reason code, for example personal_info
            </label>
            <input
              className="form-field__input"
              id={`hide-${reply.id}`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <p className="form-field__hint">
              Hidden messages are kept for moderation and can be restored from the console.
            </p>
            <div className="reply__actions">
              <button type="submit" className="button button--compact" disabled={busy}>
                Hide message
              </button>
              <button
                type="button"
                className="button button--compact"
                onClick={() => setMode("view")}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        {mode === "view" && !reply.deleted ? (
          <div className="reply__actions">
            {open && canReply ? (
              <button type="button" className="reply__action" onClick={() => onReplyTo(reply)}>
                Reply
              </button>
            ) : null}
            {editable ? (
              <button type="button" className="reply__action" onClick={() => setMode("editing")}>
                Edit
              </button>
            ) : null}
            {own ? (
              <button
                type="button"
                className="reply__action"
                onClick={() => setMode("confirm-delete")}
              >
                Delete
              </button>
            ) : null}
            {canModerate && !own ? (
              <button type="button" className="reply__action" onClick={() => setMode("hiding")}>
                Hide
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}
