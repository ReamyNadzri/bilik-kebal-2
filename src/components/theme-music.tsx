"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { PixelIcon } from "./pixel-icon";
import { attachSoundEffects, preloadSoundEffects } from "./sound-effects";

/**
 * The VAULTIX theme behind every screen: one original two-minute loop that
 * runs on without a break.
 *
 * It plays through Web Audio rather than an `<audio loop>` element, because an
 * element leaves a short gap at every lap (the MP3's padding and the seek back
 * to the start). The file carries one second of the loop on each side, so the
 * buffer loops between `loopStart` and `loopEnd` and lands on the same sample
 * whatever delay the decoder added.
 *
 * Mounted once in the shell, which the root layout keeps across client-side
 * navigation, so the music carries on from page to page instead of
 * restarting.
 *
 * On by default. Browsers refuse sound until the visitor has interacted with
 * the page, so the theme starts on the first click, tap or key press anywhere,
 * fading in. The rail's Music toggle stops and restarts it (WCAG 2.1 SC 1.4.2);
 * stopping it is remembered in this browser and wins on every later visit.
 * Remembering is a per-viewer convenience only: if storage is unavailable the
 * theme is simply on.
 *
 * The file is not fetched until the theme actually plays, and the music pauses
 * while the tab is hidden.
 *
 * Provisional audio, like every other provisional brand asset: the designer's
 * handoff replaces `THEME_TRACK` without touching this component.
 *
 * The one audio graph lives in `ThemeMusicProvider`; any number of
 * `ThemeMusicToggle`s drive it. The desktop rail and the compact menu each
 * show one, and only one is ever displayed at a time.
 */
export const THEME_TRACK = {
  src: "/audio/vaultix-theme-loop.mp3",
  title: "VAULTIX Theme",
  /** Seconds into the file where the seamless loop begins and ends. */
  loopStart: 1,
  loopEnd: 121,
} as const;
export const THEME_PREFERENCE_KEY = "vaultix.themeMusic";

const TARGET_VOLUME = 0.45;
const FADE_SECONDS = 1.5;
/** How long to wait for the browser to allow sound before treating it as refused. */
const RESUME_TIMEOUT_MS = 400;
/** The events a browser accepts as the gesture that unlocks sound. */
const GESTURES = ["pointerdown", "pointerup", "touchend", "keydown", "click"] as const;

type PlayResult = "playing" | "blocked" | "failed";

function createAudioContext(): AudioContext | null {
  const Context =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return Context === undefined ? null : new Context();
}

/** Whether the visitor has already interacted with this page, where the browser says. */
function hasBeenActive(): boolean {
  return (
    (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation
      ?.hasBeenActive === true
  );
}

function readEnabled(): boolean {
  try {
    return window.localStorage.getItem(THEME_PREFERENCE_KEY) !== "off";
  } catch {
    return true;
  }
}

function writeEnabled(enabled: boolean) {
  try {
    window.localStorage.setItem(THEME_PREFERENCE_KEY, enabled ? "on" : "off");
  } catch {
    // Remembering is a convenience; the toggle still works for this visit.
  }
}

/** Marks a toggle, so the first-gesture unlock leaves its press to it. */
const TOGGLE_ATTRIBUTE = "data-theme-music-toggle";
const STATUS_ID = "theme-music-status";

interface ThemeMusicContextValue {
  readonly playing: boolean;
  readonly toggle: () => void;
}

const ThemeMusicContext = createContext<ThemeMusicContextValue | null>(null);

/** Resolves true once the context is running, or false if it is still held after `timeoutMs`. */
function whenRunning(context: AudioContext, timeoutMs: number): Promise<boolean> {
  if (context.state === "running") return Promise.resolve(true);
  return new Promise((resolve) => {
    const settle = (running: boolean) => {
      window.clearTimeout(timer);
      context.removeEventListener("statechange", onChange);
      resolve(running);
    };
    const onChange = () => {
      if (context.state === "running") settle(true);
    };
    const timer = window.setTimeout(() => settle(context.state === "running"), timeoutMs);
    context.addEventListener("statechange", onChange);
  });
}

export function ThemeMusicProvider({ children }: { readonly children: ReactNode }) {
  const contextRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const bufferRef = useRef<Promise<AudioBuffer> | null>(null);
  const startingRef = useRef<Promise<PlayResult> | null>(null);
  const enabledRef = useRef(true);
  const resumeOnShowRef = useRef(false);
  const detachEffectsRef = useRef<(() => void) | null>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  const loadBuffer = useCallback((context: AudioContext): Promise<AudioBuffer> => {
    if (bufferRef.current !== null) return bufferRef.current;
    const pending = fetch(THEME_TRACK.src)
      .then((response) => {
        if (!response.ok) throw new Error(`The theme music answered ${response.status}`);
        return response.arrayBuffer();
      })
      .then((data) => context.decodeAudioData(data));
    // A failed load is forgotten, so pressing Music tries again.
    pending.catch(() => {
      if (bufferRef.current === pending) bufferRef.current = null;
    });
    bufferRef.current = pending;
    return pending;
  }, []);

  const start = useCallback(
    async (context: AudioContext, gain: GainNode): Promise<PlayResult> => {
      if (!(await whenRunning(context, RESUME_TIMEOUT_MS))) return "blocked";
      // The effects are small; fetch them now so the first one lands on time.
      preloadSoundEffects();

      let buffer: AudioBuffer;
      try {
        buffer = await loadBuffer(context);
      } catch {
        void context.suspend();
        setPlaying(false);
        setFailed(true);
        return "failed";
      }
      // Turned off, or the tab hidden, while the file was on its way.
      if (!enabledRef.current || document.hidden || contextRef.current !== context) {
        void context.suspend();
        return "blocked";
      }

      if (sourceRef.current === null) {
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.loopStart = THEME_TRACK.loopStart;
        source.loopEnd = Math.min(THEME_TRACK.loopEnd, buffer.duration);
        source.connect(gain);
        source.start(0, THEME_TRACK.loopStart);
        sourceRef.current = source;
      }
      const now = context.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(TARGET_VOLUME, now + FADE_SECONDS);
      setFailed(false);
      setPlaying(true);
      return "playing";
    },
    [loadBuffer],
  );

  /** Resolves "playing" once the theme is audible, "blocked" if the browser refused. */
  const play = useCallback((): Promise<PlayResult> => {
    if (contextRef.current === null) {
      const context = createAudioContext();
      if (context === null) {
        return Promise.resolve().then(() => {
          setFailed(true);
          return "failed" as const;
        });
      }
      const gain = context.createGain();
      gain.gain.value = 0;
      gain.connect(context.destination);
      contextRef.current = context;
      detachEffectsRef.current = attachSoundEffects(context);
      gainRef.current = gain;
    }
    const context = contextRef.current;
    const gain = gainRef.current;
    if (gain === null) return Promise.resolve("failed");
    // Asked for at once, inside the gesture, which is the only time Safari allows it.
    // A browser that refuses leaves the request pending, so `start` stops waiting.
    context.resume().catch(() => undefined);
    startingRef.current ??= start(context, gain).finally(() => {
      startingRef.current = null;
    });
    return startingRef.current;
  }, [start]);

  const pause = useCallback(() => {
    const context = contextRef.current;
    const gain = gainRef.current;
    if (context === null || gain === null) return;
    gain.gain.cancelScheduledValues(context.currentTime);
    void context.suspend();
    setPlaying(false);
  }, []);

  // Start now if the visitor has already interacted; otherwise on the first gesture.
  useEffect(() => {
    enabledRef.current = readEnabled();
    if (!enabledRef.current) return;

    let disposed = false;
    const arm = () => {
      for (const type of GESTURES) document.addEventListener(type, onGesture, true);
    };
    const disarm = () => {
      for (const type of GESTURES) document.removeEventListener(type, onGesture, true);
    };
    function onGesture(event: Event) {
      if (!enabledRef.current) {
        disarm();
        return;
      }
      // The toggle decides for itself; starting here as well would have the
      // same press start the theme and then stop it again.
      if (event.target instanceof Element && event.target.closest(`[${TOGGLE_ATTRIBUTE}]`)) return;
      if (event instanceof KeyboardEvent && event.key === "Escape") return;
      void play().then((result) => {
        if (result !== "blocked") disarm();
      });
    }

    if (hasBeenActive()) {
      void play().then((result) => {
        if (result === "blocked" && !disposed) arm();
      });
    } else {
      arm();
    }

    return () => {
      disposed = true;
      disarm();
    };
  }, [play]);

  // Quiet while the tab is out of sight; back where it was on return.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        if (contextRef.current?.state === "running" && sourceRef.current !== null) {
          resumeOnShowRef.current = true;
          pause();
        }
      } else if (resumeOnShowRef.current) {
        resumeOnShowRef.current = false;
        if (enabledRef.current) void play();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [pause, play]);

  // Let the audio device go when the shell goes.
  useEffect(
    () => () => {
      const context = contextRef.current;
      contextRef.current = null;
      gainRef.current = null;
      sourceRef.current = null;
      detachEffectsRef.current?.();
      detachEffectsRef.current = null;
      void context?.close();
    },
    [],
  );

  const toggle = useCallback(() => {
    if (playing) {
      enabledRef.current = false;
      writeEnabled(false);
      pause();
    } else {
      enabledRef.current = true;
      writeEnabled(true);
      void play();
    }
  }, [pause, play, playing]);

  const value = useMemo(() => ({ playing, toggle }), [playing, toggle]);

  return (
    <ThemeMusicContext.Provider value={value}>
      {children}
      <span id={STATUS_ID} className="visually-hidden" role="status">
        {failed ? "The theme music could not be loaded. Press Music to try again." : ""}
      </span>
    </ThemeMusicContext.Provider>
  );
}

/**
 * A Music on/off button for the provider above it.
 *
 * `rail` is the icon button on the desktop rail; `row` is the full-width row
 * in the compact menu, which names the state in words beside the icon.
 */
export function ThemeMusicToggle({ variant = "rail" }: { readonly variant?: "rail" | "row" }) {
  const music = useContext(ThemeMusicContext);
  if (music === null) throw new Error("ThemeMusicToggle must be used inside <ThemeMusicProvider>");
  const { playing, toggle } = music;
  const toggleMarker = { [TOGGLE_ATTRIBUTE]: "" };

  if (variant === "row") {
    return (
      <button
        type="button"
        className="shell-menu__setting"
        aria-pressed={playing}
        aria-describedby={STATUS_ID}
        onClick={toggle}
        {...toggleMarker}
      >
        <span className="shell-menu__setting-name">
          <PixelIcon name={playing ? "sound" : "sound-off"} className="shell-nav__icon" />
          Music
        </span>
        <span className="shell-menu__setting-state" aria-hidden="true">
          <span className="shell-menu__setting-dot" />
          {playing ? "On" : "Off"}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className="theme-music"
      aria-pressed={playing}
      aria-describedby={STATUS_ID}
      onClick={toggle}
      {...toggleMarker}
    >
      <PixelIcon name={playing ? "sound" : "sound-off"} className="shell-nav__icon" />
      <span className="shell-nav__link-text--secondary">Music</span>
    </button>
  );
}

/** The provider and its rail toggle together, for a screen that needs only one. */
export function ThemeMusic() {
  return (
    <ThemeMusicProvider>
      <ThemeMusicToggle />
    </ThemeMusicProvider>
  );
}
