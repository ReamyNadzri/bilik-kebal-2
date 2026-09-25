"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";

/**
 * Gunshot page transition (design_handoff_vaultix_motion, section 1).
 *
 * `GunshotProvider` wraps the shell in the root layout and renders the overlay
 * and the on/off toggle. `ShotLink` replaces `next/link` on the primary nav,
 * the wordmark, "Post a Wanted" and the Wanted card links, and nowhere else:
 * form submits, dialogs and auth redirects stay instant.
 *
 * Timeline, from the prototype: flash and bloom start at 0 ms, the route
 * changes at 390 ms (the bloom covers the screen by 400 ms), and the overlay
 * is removed at 1050 ms.
 */

const STORAGE_KEY = "vaultix.gunshot";
const NAV_AT_MS = 390;
const CLEAR_AT_MS = 1050;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

type Preference = "on" | "off";

interface Shot {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly key: number;
}

interface GunshotContextValue {
  readonly enabled: boolean;
  readonly setEnabled: (next: boolean) => void;
  readonly fire: (event: MouseEvent<HTMLElement>, href: string) => void;
}

const GunshotContext = createContext<GunshotContextValue | null>(null);

function subscribeToReducedMotion(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function readReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

const noReducedMotionOnServer = () => false;

/**
 * Whether the viewer asked the system for reduced motion.
 *
 * useSyncExternalStore rather than setState in an effect, for the reason given
 * in use-hydrated.ts; the server has no preference to read, so it answers no.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeToReducedMotion, readReducedMotion, noReducedMotionOnServer);
}

const subscribeToNothing = () => () => {};
const noSavedPreferenceOnServer = () => null;

/** Storage can be blocked (private windows, strict settings); that is not an error. */
function readSavedPreference(): Preference | null {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === "on" || saved === "off" ? saved : null;
  } catch {
    return null;
  }
}

function savePreference(next: Preference): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // The choice still holds for this visit; it just is not remembered.
  }
}

export function GunshotProvider({
  children,
  defaultEnabled = true,
}: {
  readonly children: ReactNode;
  readonly defaultEnabled?: boolean;
}) {
  const router = useRouter();
  const reduced = usePrefersReducedMotion();
  const saved = useSyncExternalStore(
    subscribeToNothing,
    readSavedPreference,
    noSavedPreferenceOnServer,
  );
  // A choice made in this visit wins over the saved one, even when storage is blocked.
  const [chosen, setChosen] = useState<Preference | null>(null);
  const enabled = (chosen ?? saved ?? (defaultEnabled ? "on" : "off")) === "on";
  const [shot, setShot] = useState<Shot | null>(null);
  const busy = useRef(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const setEnabled = useCallback((next: boolean) => {
    const preference: Preference = next ? "on" : "off";
    setChosen(preference);
    savePreference(preference);
  }, []);

  const fire = useCallback(
    (event: MouseEvent<HTMLElement>, href: string) => {
      // New tab / new window / non-primary button: let the browser handle it.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
        return;
      }
      event.preventDefault();
      if (!enabled || reduced || busy.current) {
        if (!busy.current) router.push(href);
        return;
      }
      let x = event.clientX;
      let y = event.clientY;
      // Keyboard activation (detail === 0) has no pointer position: use the element centre.
      if (event.detail === 0) {
        const rect = event.currentTarget.getBoundingClientRect();
        x = rect.left + rect.width / 2;
        y = rect.top + rect.height / 2;
      }
      busy.current = true;
      setShot({ x, y, w: window.innerWidth, h: window.innerHeight, key: Date.now() });
      router.prefetch(href);
      timers.current.push(
        window.setTimeout(() => router.push(href), NAV_AT_MS),
        window.setTimeout(() => {
          setShot(null);
          busy.current = false;
        }, CLEAR_AT_MS),
      );
    },
    [enabled, reduced, router],
  );

  const value = useMemo(() => ({ enabled, setEnabled, fire }), [enabled, setEnabled, fire]);

  return (
    <GunshotContext.Provider value={value}>
      {children}
      <GunshotToggle />
      {shot === null ? null : <ShotOverlay key={shot.key} shot={shot} />}
    </GunshotContext.Provider>
  );
}

export function useGunshot(): GunshotContextValue {
  const context = useContext(GunshotContext);
  if (context === null) throw new Error("useGunshot must be used inside <GunshotProvider>");
  return context;
}

/**
 * `next/link` with the gunshot transition. `href` must be a string.
 *
 * Outside a `GunshotProvider` it is a plain link, so a component that uses it
 * still renders on its own, in a test or a preview, with ordinary navigation.
 */
export function ShotLink({
  href,
  onClick,
  ...rest
}: Omit<ComponentProps<typeof Link>, "href"> & { readonly href: string }) {
  const gunshot = useContext(GunshotContext);
  return (
    <Link
      href={href}
      {...rest}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) gunshot?.fire(event, href);
      }}
    />
  );
}

export function GunshotToggle() {
  const { enabled, setEnabled } = useGunshot();
  return (
    <button
      type="button"
      className="gunshot-toggle"
      aria-pressed={enabled}
      aria-label="Gunshot page transition"
      onClick={() => setEnabled(!enabled)}
    >
      <span className="gunshot-toggle__dot" aria-hidden="true" />
      <span>Gunshot {enabled ? "On" : "Off"}</span>
    </button>
  );
}

type Vars = CSSProperties & Record<`--${string}`, string>;

function ShotOverlay({ shot }: { readonly shot: Shot }) {
  const { x, y } = shot;
  const R = Math.hypot(Math.max(x, shot.w - x), Math.max(y, shot.h - y)) + 60;
  const at = (style: Vars = {}): Vars => ({ left: x, top: y, ...style });

  const smoke = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2 + 0.4;
    const d = 70 + (i % 3) * 40;
    const size = 120 + (i % 3) * 40;
    return (
      <div
        key={`sm${i}`}
        className="gunshot-overlay__smoke"
        style={at({
          width: size,
          height: size,
          "--dx": `${Math.cos(a) * d}px`,
          "--dy": `${Math.sin(a) * d - 40}px`,
          "--vx-delay": `${120 + i * 25}ms`,
        })}
      />
    );
  });

  const rays = Array.from({ length: 10 }, (_, i) => (
    <div
      key={`r${i}`}
      className={`gunshot-overlay__ray${i % 2 ? " gunshot-overlay__ray--long" : ""}`}
      style={at({ "--a": `${i * 36 + 12}deg` })}
    />
  ));

  const sparks = Array.from({ length: 16 }, (_, i) => (
    <div
      key={`sp${i}`}
      className={`gunshot-overlay__spark${i % 2 ? " gunshot-overlay__spark--alt" : ""}`}
      style={at({
        "--a": `${i * 22.5 + (i % 3) * 7}deg`,
        "--d": `${-(140 + ((i * 37) % 160))}px`,
      })}
    />
  ));

  return (
    <div className="vx-motion gunshot-overlay" aria-hidden="true" data-testid="gunshot-overlay">
      <div
        className="gunshot-overlay__bloom"
        style={{ left: x - R, top: y - R, width: 2 * R, height: 2 * R }}
      />
      {smoke}
      {rays}
      <div className="gunshot-overlay__ring" style={at()} />
      {sparks}
      <div className="gunshot-overlay__flash" style={at()} />
    </div>
  );
}
