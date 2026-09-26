"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  notificationHref,
  type NotificationCode,
  type NotificationItem,
} from "@/contracts/notifications";
import { readOperation } from "@/features/presentation/call-operation";
import { markNotificationsRead } from "./notification-menu";
import { UiStatus } from "./ui-status";

type LoadState = "loading" | "ready" | "failed";
type InboxData = { items: NotificationItem[]; nextCursor: string | null };

function readInbox(cursor?: string) {
  const query = new URLSearchParams({ limit: "20" });
  if (cursor) query.set("cursor", cursor);
  return readOperation<InboxData, NotificationCode>(
    `/api/notifications?${query.toString()}`,
    "NOTIFICATIONS_UNAVAILABLE",
  );
}

export function NotificationInbox() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [updateFailed, setUpdateFailed] = useState(false);

  const load = useCallback(async (cursor?: string, append = false) => {
    if (append) setLoadingMore(true);
    const result = await readInbox(cursor);
    if (!result.ok) {
      setState("failed");
      setLoadingMore(false);
      return;
    }
    setItems((current) => (append ? [...current, ...result.data.items] : result.data.items));
    setNextCursor(result.data.nextCursor);
    setState("ready");
    setLoadingMore(false);
  }, []);

  useEffect(() => {
    let active = true;
    void readInbox().then((result) => {
      if (!active) return;
      if (!result.ok) {
        setState("failed");
        return;
      }
      setItems(result.data.items);
      setNextCursor(result.data.nextCursor);
      setState("ready");
    });
    return () => {
      active = false;
    };
  }, []);

  function markLocally(id: string | "all") {
    const now = new Date().toISOString();
    setItems((current) =>
      current.map((entry) =>
        id === "all" || entry.id === id ? { ...entry, readAt: entry.readAt ?? now } : entry,
      ),
    );
  }

  /**
   * Saves the read state, then refreshes the layout so the bell's count in
   * the rail drops too. Without the refresh the item said "Read" while the
   * badge kept its old number until the next page load.
   */
  async function markRead(target: NotificationItem | "all") {
    if (busyId) return;
    const id = target === "all" ? "all" : target.id;
    setBusyId(id);
    setUpdateFailed(false);
    const result = await markNotificationsRead(id);
    if (result.ok) {
      markLocally(id);
      router.refresh();
    } else {
      setUpdateFailed(true);
    }
    setBusyId(null);
  }

  if (state === "loading") {
    return (
      <UiStatus
        kind="loading"
        heading="Loading notifications"
        message="Checking for account and claim updates."
      />
    );
  }
  if (state === "failed") {
    return (
      <UiStatus
        kind="offline"
        heading="Notifications are unavailable"
        message="Your inbox could not be loaded. Nothing has been changed. Check your connection and try again."
        action={
          <button
            type="button"
            className="button button--secondary"
            onClick={() => {
              setState("loading");
              void load();
            }}
          >
            Try again
          </button>
        }
      />
    );
  }
  if (items.length === 0) {
    return (
      <UiStatus
        kind="empty"
        heading="No notifications yet"
        message="Claim decisions, verification results and replies to your requests will appear here."
      />
    );
  }

  return (
    <section aria-label="Your notifications" className="notification-inbox">
      {updateFailed ? (
        <UiStatus
          kind="offline"
          heading="Read status could not be saved"
          message="The notification is still in your inbox. Check your connection and try again."
        />
      ) : null}
      {items.some((item) => item.readAt === null) ? (
        <div className="notification-inbox__toolbar">
          <button
            type="button"
            className="button button--secondary button--compact"
            onClick={() => void markRead("all")}
            disabled={busyId !== null}
            aria-busy={busyId === "all"}
          >
            {busyId === "all" ? "Saving…" : "Mark all read"}
          </button>
        </div>
      ) : null}
      <ul className="notification-inbox__list">
        {items.map((item) => (
          <li
            className="notification-inbox__item"
            data-read={item.readAt ? "true" : "false"}
            key={item.id}
          >
            <div className="notification-inbox__text">
              {item.readAt ? null : (
                <span className="status-stamp status-stamp--danger notification-inbox__new">
                  New
                </span>
              )}
              <p>{item.message}</p>
              <time dateTime={item.createdAt}>
                {new Date(item.createdAt).toLocaleString("en-MY", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </time>
            </div>
            <div className="notification-inbox__actions">
              {notificationHref(item.kind, item.subjectId) ? (
                <Link
                  className="button button--secondary button--compact"
                  href={notificationHref(item.kind, item.subjectId) ?? "/"}
                  // One per notification: prefetching them all on sight
                  // would cost a server request each for pages not opened.
                  prefetch={false}
                  onClick={() => {
                    // Opening a notification reads it; the save finishes in
                    // the background while the next page loads.
                    if (item.readAt === null) void markRead(item);
                  }}
                >
                  Open
                </Link>
              ) : null}
              {item.readAt ? (
                <span className="notification-inbox__read">Read</span>
              ) : (
                <button
                  type="button"
                  className="button button--quiet button--compact"
                  onClick={() => void markRead(item)}
                  disabled={busyId !== null}
                >
                  {busyId === item.id ? "Saving…" : "Mark as read"}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {nextCursor ? (
        <button
          type="button"
          className="button button--secondary"
          onClick={() => void load(nextCursor, true)}
          disabled={loadingMore}
          aria-busy={loadingMore}
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      ) : null}
    </section>
  );
}
