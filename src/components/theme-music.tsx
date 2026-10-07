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
 * The music behind every screen: two-minute loops played in turn, the VAULTIX
 * theme and then Dead or Alive, round and round without a break.
 *
 * It plays through Web Audio rather than an `<audio>` element, because an
 * element leaves a short gap at every lap (the MP3's padding and the seek back
 * to the start). Each file carries one second of its loop on each side, so a
 * lap runs from `loopStart` to `loopEnd` whatever delay the decoder added, and
 * every handover is scheduled on the audio clock a few seconds ahead: the next
 * track fades in over the last half second of the lap while this one fades out
 * over the first half second of its margin. The second of loop on each side
 * makes that crossfade seamless even when a track hands over to itself, which
 * is what happens when the next file cannot be loaded.
 *
 * Mounted once in the shell, which the root layout keeps across client-side
 * navigation, so the music carries on from page to page instead of
 * restarting.
 *
 * On by default. Browsers refuse sound until the visitor has interacted with
 * the page, so the theme starts on the first click, tap or key press anywhere,
 * fading in. The rail's Music toggle mutes and unmutes it (WCAG 2.1 SC 1.4.2);
 * muting is remembered in this browser and wins on every later visit.
 *
 * Music mutes the theme only. The sound effects share this AudioContext, so
 * it is unlocked on the first gesture and kept running whether the theme is
 * on or not; muting fades the theme's own gain to silence instead of
 * suspending the context.
 * Remembering is a per-viewer convenience only: if storage is unavailable the
 * theme is simply on.
 *
 * The file is not fetched until the theme actually plays, and the music pauses
 * while the tab is hidden.
 *
 * Provisional audio, like every other provisional brand asset: the designer's
 * handoff replaces `THEME_TRACKS` without touching this component.
 *
 * The one audio graph lives in `ThemeMusicProvider`; any number of
 * `ThemeMusicToggle`s drive it. The desktop rail and the compact menu each
 * show one, and only one is ever displayed at a time.
 */
export const THEME_TRACKS = [
  {
    src: "/audio/vaultix-theme-loop.mp3",
    title: "VAULTIX Theme",
    /** Seconds into the file where the seamless loop begins and ends. */
    loopStart: 1,
    loopEnd: 121,
  },
  {
    src: "/audio/vaultix-dead-or-alive-loop.mp3",
    title: "Dead or Alive",
    loopStart: 1,
    loopEnd: 120.34893,
  },
] as const;
type ThemeTrack = (typeof THEME_TRACKS)[number];
export const THEME_PREFERENCE_KEY = "vaultix.themeMusic";

const TARGET_VOLUME = 0.45;
const FADE_SECONDS = 1.5;
const MUTE_FADE_SECONDS = 0.3;
/** The handover crossfade; half of it on each side, inside the files' one-second margins. */
const CROSSFADE_SECONDS = 1;
/** How far ahead of a handover the next track is scheduled on the audio clock. */
const LOOKAHEAD_SECONDS = 5;
const SCHEDULER_INTERVAL_MS = 1000;
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

/** The track whose lap was scheduled last, and the audio-clock time that lap hands over. */
interface ScheduledLap {
  readonly index: number;
  readonly handover: number;
}

function nextIndex(index: number): number {
  return (index + 1) % THEME_TRACKS.length;
}

/**
 * One lap of `track` into `output`, starting at `at` on the audio clock. With
 * `crossfade`, it enters half a crossfade early from inside the file's margin.
 * Resolves the time the lap hands over to the next one.
 */
function scheduleLap(
  context: AudioContext,
  output: AudioNode,
  track: ThemeTrack,
  buffer: AudioBuffer,
  at: number,
  crossfade: boolean,
): number {
  const half = CROSSFADE_SECONDS / 2;
  const lapEnd = Math.min(track.loopEnd, buffer.duration - half);
  const handover = at + (lapEnd - track.loopStart);
  const voice = context.createGain();
  voice.connect(output);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(voice);
  if (crossfade) {
    voice.gain.setValueAtTime(0, at - half);
    voice.gain.linearRampToValueAtTime(1, at + half);
    source.start(at - half, track.loopStart - half);
  } else {
    source.start(at, track.loopStart);
  }
  voice.gain.setValueAtTime(1, handover - half);
  voice.gain.linearRampToValueAtTime(0, handover + half);
  source.stop(handover + half);
  source.onended = () => {
    source.disconnect();
    voice.disconnect();
  };
  return handover;
}

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
  const lapRef = useRef<ScheduledLap | null>(null);
  const schedulerRef = useRef<number | null>(null);
  const pendingRef = useRef(new Map<number, Promise<AudioBuffer>>());
  const loadedRef = useRef(new Map<number, AudioBuffer>());
  const startingRef = useRef<Promise<PlayResult> | null>(null);
  const enabledRef = useRef(true);
  const resumeOnShowRef = useRef(false);
  const detachEffectsRef = useRef<(() => void) | null>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  const loadBuffer = useCallback((context: AudioContext, index: number): Promise<AudioBuffer> => {
    const known = pendingRef.current.get(index);
    if (known !== undefined) return known;
    const track = THEME_TRACKS[index];
    if (track === undefined) return Promise.reject(new Error(`No theme track ${index}`));
    const pending = fetch(track.src)
      .then((response) => {
        if (!response.ok) throw new Error(`The theme music answered ${response.status}`);
        return response.arrayBuffer();
      })
      .then((data) => context.decodeAudioData(data));
    pending.then(
      (buffer) => loadedRef.current.set(index, buffer),
      // A failed load is forgotten, so it is tried again: by Music, or at the next handover.
      () => {
        if (pendingRef.current.get(index) === pending) pendingRef.current.delete(index);
      },
    );
    pendingRef.current.set(index, pending);
    return pending;
  }, []);

  /** Fetches a track ahead of its turn; a failure only means the current one goes round again. */
  const prefetch = useCallback(
    (context: AudioContext, index: number) => {
      loadBuffer(context, index).catch(() => undefined);
    },
    [loadBuffer],
  );

  /**
   * Schedules the next lap a few seconds before the current one hands over:
   * the next track if its file is here, otherwise the current one again.
   */
  const scheduleAhead = useCallback(() => {
    const context = contextRef.current;
    const gain = gainRef.current;
    const lap = lapRef.current;
    if (context === null || gain === null || lap === null) return;
    if (context.currentTime < lap.handover - LOOKAHEAD_SECONDS) return;
    const wanted = nextIndex(lap.index);
    const ready = loadedRef.current.get(wanted);
    const index = ready === undefined ? lap.index : wanted;
    const buffer = ready ?? loadedRef.current.get(lap.index);
    const track = THEME_TRACKS[index];
    if (buffer === undefined || track === undefined) return;
    const handover = scheduleLap(context, gain, track, buffer, lap.handover, true);
    lapRef.current = { index, handover };
    prefetch(context, ready === undefined ? wanted : nextIndex(index));
  }, [prefetch]);

  const start = useCallback(
    async (context: AudioContext, gain: GainNode): Promise<PlayResult> => {
      if (!(await whenRunning(context, RESUME_TIMEOUT_MS))) return "blocked";
      // The effects are small; fetch them now so the first one lands on time.
      preloadSoundEffects();

      let buffer: AudioBuffer;
      try {
        buffer = await loadBuffer(context, 0);
      } catch {
        setPlaying(false);
        setFailed(true);
        return "failed";
      }
      // Muted, or the tab hidden, while the file was on its way. The context
      // stays as it is: the sound effects still use it.
      if (!enabledRef.current || document.hidden || contextRef.current !== context) {
        return "blocked";
      }

      if (lapRef.current === null) {
        const first = THEME_TRACKS[0];
        const handover = scheduleLap(context, gain, first, buffer, context.currentTime, false);
        lapRef.current = { index: 0, handover };
        prefetch(context, nextIndex(0));
        schedulerRef.current ??= window.setInterval(scheduleAhead, SCHEDULER_INTERVAL_MS);
      }
      const now = context.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(TARGET_VOLUME, now + FADE_SECONDS);
      setFailed(false);
      setPlaying(true);
      return "playing";
    },
    [loadBuffer, prefetch, scheduleAhead],
  );

  /** The one AudioContext, created on first use, with the effects routed through it. */
  const ensureContext = useCallback((): { context: AudioContext; gain: GainNode } | null => {
    if (contextRef.current === null) {
      const context = createAudioContext();
      if (context === null) return null;
      const gain = context.createGain();
      gain.gain.value = 0;
      gain.connect(context.destination);
      contextRef.current = context;
      detachEffectsRef.current = attachSoundEffects(context);
      gainRef.current = gain;
    }
    const gain = gainRef.current;
    return gain === null ? null : { context: contextRef.current, gain };
  }, []);

  /**
   * Lets the page make sound without starting the theme, for the effects of a
   * visitor who muted the music. Resolves whether the browser allowed it.
   */
  const unlock = useCallback(async (): Promise<boolean> => {
    const made = ensureContext();
    if (made === null) return false;
    made.context.resume().catch(() => undefined);
    const running = await whenRunning(made.context, RESUME_TIMEOUT_MS);
    if (running) preloadSoundEffects();
    return running;
  }, [ensureContext]);

  /** Resolves "playing" once the theme is audible, "blocked" if the browser refused. */
  const play = useCallback((): Promise<PlayResult> => {
    const made = ensureContext();
    if (made === null) {
      return Promise.resolve().then(() => {
        setFailed(true);
        return "failed" as const;
      });
    }
    const { context, gain } = made;
    // Asked for at once, inside the gesture, which is the only time Safari allows it.
    // A browser that refuses leaves the request pending, so `start` stops waiting.
    context.resume().catch(() => undefined);
    startingRef.current ??= start(context, gain).finally(() => {
      startingRef.current = null;
    });
    return startingRef.current;
  }, [ensureContext, start]);

  /** Fades the theme out; the context keeps running for the sound effects. */
  const mute = useCallback(() => {
    const context = contextRef.current;
    const gain = gainRef.current;
    setPlaying(false);
    if (context === null || gain === null) return;
    const now = context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + MUTE_FADE_SECONDS);
  }, []);

  // Start now if the visitor has already interacted; otherwise on the first
  // gesture. With the music muted, the gesture still unlocks sound for the
  // effects.
  useEffect(() => {
    enabledRef.current = readEnabled();

    let disposed = false;
    const arm = () => {
      for (const type of GESTURES) document.addEventListener(type, onGesture, true);
    };
    const disarm = () => {
      for (const type of GESTURES) document.removeEventListener(type, onGesture, true);
    };
    const begin = (): Promise<boolean> =>
      enabledRef.current ? play().then((result) => result !== "blocked") : unlock();
    function onGesture(event: Event) {
      // The toggle decides for itself; starting here as well would have the
      // same press start the theme and then stop it again.
      if (event.target instanceof Element && event.target.closest(`[${TOGGLE_ATTRIBUTE}]`)) return;
      if (event instanceof KeyboardEvent && event.key === "Escape") return;
      void begin().then((settled) => {
        if (settled) disarm();
      });
    }

    if (hasBeenActive()) {
      void begin().then((settled) => {
        if (!settled && !disposed) arm();
      });
    } else {
      arm();
    }

    return () => {
      disposed = true;
      disarm();
    };
  }, [play, unlock]);

  // Quiet while the tab is out of sight; back where it was on return.
  useEffect(() => {
    const onVisibility = () => {
      const context = contextRef.current;
      if (context === null) return;
      if (document.hidden) {
        if (context.state === "running") {
          resumeOnShowRef.current = true;
          void context.suspend();
        }
      } else if (resumeOnShowRef.current) {
        resumeOnShowRef.current = false;
        if (enabledRef.current) void play();
        else void unlock();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [play, unlock]);

  // Let the audio device go when the shell goes.
  useEffect(
    () => () => {
      const context = contextRef.current;
      contextRef.current = null;
      gainRef.current = null;
      lapRef.current = null;
      if (schedulerRef.current !== null) window.clearInterval(schedulerRef.current);
      schedulerRef.current = null;
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
      mute();
    } else {
      enabledRef.current = true;
      writeEnabled(true);
      void play();
    }
  }, [mute, play, playing]);

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
