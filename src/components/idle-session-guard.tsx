"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  IDLE_WARNING_MS,
  LAST_ACTIVITY_KEY,
  MEMBER_IDLE_MS,
  STAFF_IDLE_MS,
  idlePhase,
  type IdlePhase,
} from "@/lib/idle-policy";

const CHECK_EVERY_MS = 15_000;
const RECORD_EVERY_MS = 30_000;
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "scroll", "touchstart"] as const;

function readLastActivity(): number | null {
  try {
    const value = Number(window.localStorage.getItem(LAST_ACTIVITY_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function writeLastActivity(at: number) {
  try {
    window.localStorage.setItem(LAST_ACTIVITY_KEY, String(at));
  } catch {
    // Private windows can refuse storage; this tab's own timer still applies.
  }
}

/**
 * Signs an idle account out: 30 minutes for Sheriffs and the Owner (warned
 * 2 minutes before, with a button to stay), 7 days for members. Activity in
 * any tab counts for all of them.
 */
export function IdleSessionGuard({
  staff,
  onExpire,
}: {
  readonly staff: boolean;
  readonly onExpire: () => void;
}) {
  const limit = staff ? STAFF_IDLE_MS : MEMBER_IDLE_MS;
  const [phase, setPhase] = useState<IdlePhase>("active");
  // Set on mount by markActive(true); 0 until then.
  const localActivity = useRef(0);
  const lastRecorded = useRef(0);
  const expired = useRef(false);
  const stayRef = useRef<HTMLButtonElement>(null);

  const markActive = useCallback((force = false) => {
    const now = Date.now();
    localActivity.current = now;
    if (force || now - lastRecorded.current >= RECORD_EVERY_MS) {
      lastRecorded.current = now;
      writeLastActivity(now);
    }
  }, []);

  useEffect(() => {
    markActive(true);
  }, [markActive]);

  useEffect(() => {
    const onActivity = () => {
      // During the warning only the explicit button counts, so a stray scroll
      // does not silently dismiss it.
      if (phase === "active") markActive();
    };
    for (const name of ACTIVITY_EVENTS) {
      window.addEventListener(name, onActivity, { passive: true });
    }
    const timer = window.setInterval(() => {
      const last = Math.max(localActivity.current, readLastActivity() ?? 0);
      const next = idlePhase(Date.now() - last, limit, staff);
      setPhase(next);
      if (next === "expired" && !expired.current) {
        expired.current = true;
        onExpire();
      }
    }, CHECK_EVERY_MS);
    return () => {
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, onActivity);
      window.clearInterval(timer);
    };
  }, [limit, markActive, onExpire, phase, staff]);

  useEffect(() => {
    if (phase === "warning") stayRef.current?.focus();
  }, [phase]);

  if (phase !== "warning") return null;

  return (
    <div
      className="panel ops-panel idle-warning"
      role="alertdialog"
      aria-labelledby="idle-warning-title"
      aria-describedby="idle-warning-text"
    >
      <h2 className="ops-panel__title" id="idle-warning-title">
        Are you still there?
      </h2>
      <p id="idle-warning-text">
        Sheriff and Owner accounts are signed out after 30 minutes without activity. You will be
        signed out in about {Math.round(IDLE_WARNING_MS / 60_000)} minutes.
      </p>
      <button
        ref={stayRef}
        type="button"
        className="button button--primary"
        onClick={() => {
          markActive(true);
          setPhase("active");
        }}
      >
        Stay signed in
      </button>
    </div>
  );
}
