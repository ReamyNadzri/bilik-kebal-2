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
  useTransition,
  type ComponentProps,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";
import { LoadingIndicator } from "@/components/loading/loading-indicator";
import { playSoundEffect } from "../sound-effects";

/**
 * Gunshot page transition (design_handoff_vaultix_motion, section 1).
 *
 * `GunshotProvider` wraps the shell in the root layout and renders the overlay
 * and the on/off toggle. `ShotLink` replaces `next/link` on the primary nav,
 * the wordmark, "Post a Wanted" and the Wanted card links, and nowhere else:
 * form submits, dialogs and auth redirects stay instant.
 *
 * Timeline: flash and bloom start at 0 ms and the overlay is removed at
 * 1050 ms. The route is requested at the click, not when the bloom covers the
 * screen (390 ms in the prototype): waiting added that much to every page.
 * Until the new page (or its skeleton) has rendered, the loading indicator
 * says it is still coming, so a slow page never looks like an ignored click.
 */

const STORAGE_KEY = "vaultix.gunshot";
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
  /** Navigates with the transition from a screen point, for gestures that are not clicks. */
  readonly go: (href: string, point: { readonly x: number; readonly y: number }) => void;
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
  defaultEnabled = false,
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
  const [navigating, startNavigation] = useTransition();
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

  const shoot = useCallback(
    (href: string, x: number, y: number) => {
      if (busy.current) return;
      // In a transition, so `navigating` stays true until the new page renders.
      const navigate = () => startNavigation(() => router.push(href));
      if (!enabled || reduced) {
        navigate();
        return;
      }
      busy.current = true;
      playSoundEffect("gunshot");
      setShot({ x, y, w: window.innerWidth, h: window.innerHeight, key: Date.now() });
      navigate();
      timers.current.push(
        window.setTimeout(() => {
          setShot(null);
          busy.current = false;
        }, CLEAR_AT_MS),
      );
    },
    [enabled, reduced, router],
  );

  const fire = useCallback(
    (event: MouseEvent<HTMLElement>, href: string) => {
      // New tab / new window / non-primary button: let the browser handle it.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
        return;
      }
      event.preventDefault();
      let x = event.clientX;
      let y = event.clientY;
      // Keyboard activation (detail === 0) has no pointer position: use the element centre.
      if (event.detail === 0) {
        const rect = event.currentTarget.getBoundingClientRect();
        x = rect.left + rect.width / 2;
        y = rect.top + rect.height / 2;
      }
      shoot(href, x, y);
    },
    [shoot],
  );

  const go = useCallback(
    (href: string, point: { readonly x: number; readonly y: number }) =>
      shoot(href, point.x, point.y),
    [shoot],
  );

  const value = useMemo(() => ({ enabled, setEnabled, fire, go }), [enabled, setEnabled, fire, go]);

  return (
    <GunshotContext.Provider value={value}>
      {children}
      <GunshotToggle />
      {shot === null ? null : <ShotOverlay key={shot.key} shot={shot} />}
      {navigating ? <LoadingIndicator /> : null}
    </GunshotContext.Provider>
  );
}

/** The transition when a provider is mounted, or null in a bare test or preview. */
export function useOptionalGunshot(): GunshotContextValue | null {
  return useContext(GunshotContext);
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
