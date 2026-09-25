"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  notificationHref,
  type NotificationCode,
  type NotificationItem,
} from "@/contracts/notifications";
import { callOperation, readOperation } from "@/features/presentation/call-operation";
import { PixelIcon } from "./pixel-icon";
import { Spinner } from "./spinner";

const LATEST = 8;

type Load =
  | { readonly kind: "idle" | "loading" | "failed" }
  | { readonly kind: "ready"; readonly items: readonly NotificationItem[] };

/** Marks one notification read, or every unread one with `"all"`. */
export function markNotificationsRead(target: string | "all") {
  return callOperation<{ read: true }, NotificationCode>(
    "/api/notifications",
    target === "all" ? { all: true } : { id: target },
    "NOTIFICATIONS_UNAVAILABLE",
    "PATCH",
  );
}

const WHEN = new Intl.DateTimeFormat("en-MY", { dateStyle: "medium", timeStyle: "short" });

/**
 * The bell in the rail. Pressing it opens the latest notifications in place;
 * opening one marks it read, and "Mark all read" clears the badge. The full
 * inbox stays at /notifications for older items.
 *
 * A disclosure rather than an ARIA menu: the panel holds links and buttons
 * reached with Tab like any other content. Escape closes it and returns focus
 * to the bell; so does a press outside it.
 *
 * The badge count comes from the layout. It drops here straight away when
 * something is read, and `router.refresh()` then re-reads it from the server
 * so every screen agrees.
 */
export function NotificationMenu({
  unreadCount,
  current,
}: {
  readonly unreadCount: number;
  readonly current: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const panelId = useId();
  const rootRef = useRef<HTMLLIElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [load, setLoad] = useState<Load>({ kind: "idle" });
  const [busy, setBusy] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [placement, setPlacement] = useState<{ top: number; left: number } | null>(null);

  // Follow the server's count whenever the layout sends a new one.
  const [count, setCount] = useState(unreadCount);
  const [seenCount, setSeenCount] = useState(unreadCount);
  if (seenCount !== unreadCount) {
    setSeenCount(unreadCount);
    setCount(unreadCount);
  }

  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setOpen(false);
  }

  const fetchLatest = useCallback(async () => {
    setLoad({ kind: "loading" });
    const result = await readOperation<{ items: NotificationItem[] }, NotificationCode>(
      `/api/notifications?limit=${LATEST}`,
      "NOTIFICATIONS_UNAVAILABLE",
    );
    setLoad(result.ok ? { kind: "ready", items: result.data.items } : { kind: "failed" });
  }, []);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  // Keep the panel under the bell and inside the screen, including at 360 px
  // where the bell sits mid-rail.
  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;
    const rect = trigger.getBoundingClientRect();
    const margin = 12;
    const width = panel.offsetWidth;
    const viewport = document.documentElement.clientWidth;
    const left = Math.min(Math.max(margin, rect.right - width), viewport - width - margin);
    setPlacement({ top: rect.bottom + 4, left: Math.max(margin, left) });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, { passive: true });
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setSaveFailed(false);
    setOpen(true);
    void fetchLatest();
  }

  function markLocally(ids: ReadonlySet<string> | "all") {
    setLoad((current) =>
      current.kind === "ready"
        ? {
            kind: "ready",
            items: current.items.map((item) =>
              item.readAt === null && (ids === "all" || ids.has(item.id))
                ? { ...item, readAt: new Date().toISOString() }
                : item,
            ),
          }
        : current,
    );
  }

  async function openItem(item: NotificationItem) {
    if (item.readAt !== null) return;
    markLocally(new Set([item.id]));
    setCount((value) => Math.max(0, value - 1));
    const result = await markNotificationsRead(item.id);
    if (result.ok) router.refresh();
  }

  async function markAll() {
    setBusy(true);
    setSaveFailed(false);
    const result = await markNotificationsRead("all");
    setBusy(false);
    if (!result.ok) {
      setSaveFailed(true);
      return;
    }
    markLocally("all");
    setCount(0);
    router.refresh();
  }

  const items = load.kind === "ready" ? load.items : [];
  const anyUnread = count > 0 || items.some((item) => item.readAt === null);

  return (
    <li
      ref={rootRef}
      className={`notification-menu${open ? " notification-menu--open" : ""}`}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          close(true);
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="shell-nav__link notification-menu__trigger"
        aria-expanded={open}
        aria-controls={panelId}
        aria-current={current ? "page" : undefined}
        onClick={toggle}
      >
        <PixelIcon name="bell" className="shell-nav__icon" />
        <span className="shell-nav__link-text--secondary">Notifications</span>
        {count > 0 ? (
          <span className="shell-nav__badge">
            <span aria-hidden="true">{count > 99 ? "99+" : count}</span>
            <span className="visually-hidden">{`, ${count} unread`}</span>
          </span>
        ) : null}
      </button>

      <div
        ref={panelRef}
        id={panelId}
        className="notification-menu__panel"
        hidden={!open}
        style={
          placement
            ? ({
                "--notification-menu-top": `${placement.top}px`,
                "--notification-menu-left": `${placement.left}px`,
              } as CSSProperties)
            : undefined
        }
      >
        <div className="notification-menu__head">
          <p className="notification-menu__title">Notifications</p>
          <button
            type="button"
            className="button button--quiet button--compact"
            onClick={() => void markAll()}
            disabled={busy || !anyUnread}
            aria-busy={busy}
          >
            {busy ? "Saving…" : "Mark all read"}
          </button>
        </div>

        {saveFailed ? (
          <p className="notification-menu__notice" role="alert">
            Read status could not be saved. Check your connection and try again.
          </p>
        ) : null}

        {load.kind === "loading" || load.kind === "idle" ? (
          <p className="notification-menu__state" role="status">
            <Spinner /> Loading notifications…
          </p>
        ) : load.kind === "failed" ? (
          <div className="notification-menu__state" role="alert">
            <p>Notifications could not be loaded. Nothing has been changed.</p>
            <button
              type="button"
              className="button button--secondary button--compact"
              onClick={() => void fetchLatest()}
            >
              Try again
            </button>
          </div>
        ) : items.length === 0 ? (
          <p className="notification-menu__state">No notifications yet.</p>
        ) : (
          <ul className="notification-menu__list">
            {items.map((item) => {
              const href = notificationHref(item.kind, item.subjectId) ?? "/notifications";
              return (
                <li key={item.id} data-read={item.readAt ? "true" : "false"}>
                  <Link
                    className="notification-menu__item"
                    href={href}
                    onClick={() => {
                      void openItem(item);
                      setOpen(false);
                    }}
                  >
                    {item.readAt ? null : (
                      <span className="notification-menu__dot" aria-hidden="true" />
                    )}
                    <span className="notification-menu__text">
                      {item.readAt ? null : <span className="visually-hidden">Unread: </span>}
                      {item.message}
                      <time dateTime={item.createdAt}>{WHEN.format(new Date(item.createdAt))}</time>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <Link
          className="notification-menu__all"
          href="/notifications"
          onClick={() => setOpen(false)}
        >
          See all notifications
        </Link>
      </div>
    </li>
  );
}
