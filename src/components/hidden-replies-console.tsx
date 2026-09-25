"use client";

import Link from "next/link";
import { useState } from "react";
import { ConfirmIdentity } from "./confirm-identity";
import type { ConsoleOperationCode, HiddenReply } from "@/contracts/console";
import { callOperation } from "@/features/presentation/call-operation";

const DATE = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kuala_Lumpur",
});

/**
 * Chat messages a Sheriff or the Owner hid. Their text is kept for
 * moderation and never shown to members; restoring puts the message back in
 * its thread. Each restore is audited by the database.
 */
export function HiddenRepliesConsole({ replies }: { readonly replies: readonly HiddenReply[] }) {
  const [restored, setRestored] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [stepUp, setStepUp] = useState<string | null>(null);

  async function restore(id: string) {
    setError(null);
    const result = await callOperation<{ done: true }, ConsoleOperationCode>(
      `/api/console/hidden-replies/${encodeURIComponent(id)}/restore`,
      {},
      "CONSOLE_UNAVAILABLE",
    );
    if (!result.ok) {
      if (result.code === "RECENT_AUTH_REQUIRED") setStepUp(id);
      else setError(result.message || "The message could not be restored.");
      return;
    }
    setStepUp(null);
    setRestored((current) => new Set(current).add(id));
  }

  const visible = replies.filter((reply) => !restored.has(reply.id));

  return (
    <section className="panel ops-panel" aria-labelledby="hidden-heading">
      <h2 className="ops-panel__title" id="hidden-heading">
        Hidden chat messages
      </h2>
      <p className="form-field__hint">
        Members cannot read these. They are kept for moderation and are not deleted with their
        thread.
      </p>
      {error ? (
        <p className="form-field__error" role="alert">
          {error}
        </p>
      ) : null}
      {visible.length === 0 ? (
        <p className="replies__empty">No hidden messages.</p>
      ) : (
        <ul className="ops-list">
          {visible.map((reply) => (
            <li key={reply.id} className="reply">
              <div className="reply__body">
                <p className="reply__meta">
                  <Link href={`/u/${reply.author.publicId}`}>{reply.author.displayName}</Link> on{" "}
                  <Link href={`/wanted/${reply.wanted.id}`}>{reply.wanted.title}</Link>
                </p>
                <p className="reply__text">{reply.body}</p>
                <p className="reply__meta">
                  Hidden {DATE.format(new Date(reply.hiddenAt))}
                  {reply.hiddenBy ? ` by ${reply.hiddenBy}` : ""} · reason {reply.reasonCode}
                </p>
                {stepUp === reply.id ? (
                  <ConfirmIdentity
                    purpose="restore this message"
                    onConfirmed={() => void restore(reply.id)}
                  />
                ) : (
                  <div className="reply__actions">
                    <button
                      type="button"
                      className="button button--compact"
                      onClick={() => void restore(reply.id)}
                    >
                      Restore to the thread
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
