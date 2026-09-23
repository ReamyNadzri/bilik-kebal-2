"use client";

import { useCallback, useEffect, useState } from "react";
import type { NotificationCode, NotificationItem } from "@/contracts/notifications";
import { callOperation, readOperation } from "@/features/presentation/call-operation";
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

  async function markRead(item: NotificationItem) {
    if (busyId) return;
    setBusyId(item.id);
    setUpdateFailed(false);
    const result = await callOperation<{ read: true }, NotificationCode>(
      "/api/notifications",
      { id: item.id },
      "NOTIFICATIONS_UNAVAILABLE",
      "PATCH",
    );
    if (result.ok) {
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? { ...entry, readAt: entry.readAt ?? new Date().toISOString() }
            : entry,
        ),
      );
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
        message="Important account, verification and claim updates will appear here."
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
      <ul className="notification-inbox__list">
        {items.map((item) => (
          <li
            className="notification-inbox__item"
            data-read={item.readAt ? "true" : "false"}
            key={item.id}
          >
            <div>
              <p>{item.message}</p>
              <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
            </div>
            {item.readAt ? (
              <span>Read</span>
            ) : (
              <button type="button" onClick={() => void markRead(item)} disabled={busyId !== null}>
                {busyId === item.id ? "Saving…" : "Mark as read"}
              </button>
            )}
          </li>
        ))}
      </ul>
      {nextCursor ? (
        <button
          type="button"
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
