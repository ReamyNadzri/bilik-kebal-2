"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useOptionalGunshot } from "./motion/gunshot-transition";
import { useShellMenu } from "./shell-menu";
import {
  modalIsOpen,
  swipeDestination,
  touchBelongsElsewhere,
} from "@/features/presentation/page-swipe";
import { MOBILE_QUERY, useMediaQuery } from "@/features/presentation/viewport";

export const SWIPE_HINT_KEY = "vaultix.swipeHint";
const HINT_VISIBLE_MS = 7000;

const subscribeToNothing = () => () => {};
/** The server cannot know; saying "seen" keeps the hint out of server HTML. */
const seenOnServer = () => true;

/** Storage can be blocked; then the hint shows once per visit instead. */
function readHintSeen(): boolean {
  try {
    return window.localStorage.getItem(SWIPE_HINT_KEY) === "seen";
  } catch {
    return false;
  }
}

function rememberHintSeen(): void {
  try {
    window.localStorage.setItem(SWIPE_HINT_KEY, "seen");
  } catch {
    // Remembering is a convenience; it is dismissed for this visit either way.
  }
}

interface TouchStart {
  readonly x: number;
  readonly y: number;
  readonly at: number;
  readonly target: EventTarget | null;
}

/**
 * Page swipes and their one-time hint on a phone
 * (design_handoff_vaultix_mobile, §4b and §4c).
 *
 * Below 720 px a quick sideways swipe moves between Home, the Board, the Map,
 * Hunt and the Archive with the gunshot transition. The tab bar and the menu
 * reach the same pages, so a swipe is a shortcut, never the only way.
 *
 * A swipe is ignored when the menu or a modal is open, or when it began in a
 * field or on a rail that scrolls sideways.
 *
 * The hint appears once, on the first phone-width visit. It goes on a tap,
 * after the first page swipe, or seven seconds after it is actually on
 * screen; the clock stops if the window widens or the menu covers it.
 */
export function PageSwipe() {
  const mobile = useMediaQuery(MOBILE_QUERY);
  const { open: menuOpen } = useShellMenu();
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const gunshot = useOptionalGunshot();
  const seen = useSyncExternalStore(subscribeToNothing, readHintSeen, seenOnServer);
  const [dismissed, setDismissed] = useState(false);
  const start = useRef<TouchStart | null>(null);

  const hintShown = mobile && !menuOpen && !seen && !dismissed;

  const dismissHint = useCallback(() => {
    setDismissed(true);
    rememberHintSeen();
  }, []);

  useEffect(() => {
    if (!hintShown) return;
    const timer = window.setTimeout(dismissHint, HINT_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [hintShown, dismissHint]);

  useEffect(() => {
    if (!mobile) return;

    function onTouchStart(event: TouchEvent) {
      const touch = event.touches[0];
      start.current =
        touch === undefined || event.touches.length > 1
          ? null
          : { x: touch.clientX, y: touch.clientY, at: Date.now(), target: event.target };
    }

    function onTouchEnd(event: TouchEvent) {
      const began = start.current;
      start.current = null;
      const touch = event.changedTouches[0];
      if (began === null || touch === undefined || menuOpen) return;

      const destination = swipeDestination(pathname, {
        dx: touch.clientX - began.x,
        dy: touch.clientY - began.y,
        ms: Date.now() - began.at,
      });
      if (destination === null) return;
      if (touchBelongsElsewhere(began.target) || modalIsOpen()) return;

      dismissHint();
      const point = { x: touch.clientX, y: touch.clientY };
      if (gunshot === null) router.push(destination);
      else gunshot.go(destination, point);
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [mobile, menuOpen, pathname, router, gunshot, dismissHint]);

  if (!hintShown) return null;

  return (
    <button type="button" className="swipe-hint" onClick={dismissHint}>
      <span className="swipe-hint__sway" aria-hidden="true">
        ‹ ● ›
      </span>
      <span>Swipe sideways to switch pages</span>
      <span className="visually-hidden">, dismiss</span>
      <span className="swipe-hint__close" aria-hidden="true">
        ✕
      </span>
    </button>
  );
}
