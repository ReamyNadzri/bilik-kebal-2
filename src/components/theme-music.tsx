"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PixelIcon } from "./pixel-icon";

/**
 * The VAULTIX soundtrack behind every screen: three original two-minute
 * songs played in turn (the theme, Boomtown, Campfire, then the theme again).
 *
 * Mounted once in the shell, which the root layout keeps across client-side
 * navigation, so the music carries on from page to page instead of
 * restarting.
 *
 * On by default. Browsers refuse sound until the visitor has interacted with
 * the page, so if the first attempt is refused the theme starts on the first
 * click, tap or key press anywhere, fading in. The rail's Music toggle stops
 * and restarts it (WCAG 2.1 SC 1.4.2); stopping it is remembered in this
 * browser and wins on every later visit. Remembering is a per-viewer
 * convenience only: if storage is unavailable the theme is simply on.
 *
 * A song is not fetched until it actually plays (`preload="none"`), and the
 * music pauses while the tab is hidden.
 *
 * Provisional audio, like every other provisional brand asset: the designer's
 * handoff replaces the files in `THEME_TRACKS` without touching this component.
 */
export const THEME_TRACKS = [
  { src: "/audio/vaultix-theme.mp3", title: "VAULTIX Theme" },
  { src: "/audio/vaultix-boomtown.mp3", title: "Boomtown" },
  { src: "/audio/vaultix-campfire.mp3", title: "Campfire" },
] as const;
export const THEME_PREFERENCE_KEY = "vaultix.themeMusic";

const TARGET_VOLUME = 0.45;
const FADE_MS = 1500;
/** The events a browser accepts as the gesture that unlocks sound. */
const GESTURES = ["pointerdown", "pointerup", "touchend", "keydown", "click"] as const;

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

export function ThemeMusic() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const enabledRef = useRef(true);
  const resumeOnShowRef = useRef(false);
  const fadeRef = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [track, setTrack] = useState(0);
  const startedTrackRef = useRef(0);
  const song = THEME_TRACKS[track] ?? THEME_TRACKS[0];

  const stopFade = useCallback(() => {
    if (fadeRef.current !== null) {
      cancelAnimationFrame(fadeRef.current);
      fadeRef.current = null;
    }
  }, []);

  const fadeIn = useCallback(
    (audio: HTMLAudioElement) => {
      stopFade();
      if (typeof requestAnimationFrame !== "function") {
        audio.volume = TARGET_VOLUME;
        return;
      }
      const started = performance.now();
      const step = (now: number) => {
        // A frame's timestamp is when the frame began, which can fall a moment
        // before `started`; a negative volume throws and would leave it silent.
        const progress = Math.min(1, Math.max(0, (now - started) / FADE_MS));
        audio.volume = TARGET_VOLUME * progress;
        fadeRef.current = progress < 1 ? requestAnimationFrame(step) : null;
      };
      fadeRef.current = requestAnimationFrame(step);
    },
    [stopFade],
  );

  /** Resolves true once the theme is playing, false if the browser refused. */
  const play = useCallback(async (): Promise<boolean> => {
    const audio = audioRef.current;
    if (audio === null) return false;
    if (!audio.paused) return true;
    audio.volume = 0;
    try {
      await audio.play();
    } catch {
      // Refused: leave it audible for a later resume from the media keys.
      audio.volume = TARGET_VOLUME;
      return false;
    }
    setFailed(false);
    fadeIn(audio);
    return true;
  }, [fadeIn]);

  // The pressed state follows the element itself, so a pause from the
  // operating system's media controls shows on the rail too.
  useEffect(() => {
    const audio = audioRef.current;
    if (audio === null) return;
    const onPlay = () => setPlaying(true);
    // A song reaching its end pauses the element on its way to the next one;
    // the rail stays on through that handover.
    const onPause = () => {
      if (!audio.ended) setPlaying(false);
    };
    const onEnded = () => setTrack((current) => (current + 1) % THEME_TRACKS.length);
    const onError = () => {
      setPlaying(false);
      setFailed(true);
    };
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, []);

  // When one song ends, the next one starts.
  useEffect(() => {
    if (startedTrackRef.current === track) return;
    startedTrackRef.current = track;
    if (!enabledRef.current) return;
    void play().then((started) => {
      if (!started) setPlaying(false);
    });
  }, [track, play]);

  // The operating system's media controls name the song that is playing.
  useEffect(() => {
    if (!playing || !("mediaSession" in navigator) || typeof MediaMetadata === "undefined") return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: song.title,
      artist: "VAULTIX",
    });
  }, [playing, song]);

  // Start now if the browser allows it; otherwise on the first gesture.
  useEffect(() => {
    enabledRef.current = readEnabled();
    if (!enabledRef.current) return;

    let disposed = false;
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
      if (event.target instanceof Node && buttonRef.current?.contains(event.target)) return;
      if (event instanceof KeyboardEvent && event.key === "Escape") return;
      void play().then((started) => {
        if (started) disarm();
      });
    }

    void play().then((started) => {
      if (started || disposed) return;
      for (const type of GESTURES) document.addEventListener(type, onGesture, true);
    });

    return () => {
      disposed = true;
      disarm();
    };
  }, [play]);

  // Quiet while the tab is out of sight; back where it was on return.
  useEffect(() => {
    const onVisibility = () => {
      const audio = audioRef.current;
      if (audio === null) return;
      if (document.hidden) {
        if (!audio.paused) {
          resumeOnShowRef.current = true;
          stopFade();
          audio.pause();
        }
      } else if (resumeOnShowRef.current) {
        resumeOnShowRef.current = false;
        if (enabledRef.current) void play();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [play, stopFade]);

  useEffect(() => stopFade, [stopFade]);

  function toggle() {
    const audio = audioRef.current;
    if (audio === null) return;
    if (audio.paused) {
      enabledRef.current = true;
      writeEnabled(true);
      if (failed) audio.load();
      void play();
    } else {
      enabledRef.current = false;
      writeEnabled(false);
      stopFade();
      audio.pause();
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="theme-music"
        aria-pressed={playing}
        aria-describedby="theme-music-status"
        onClick={toggle}
      >
        <PixelIcon name={playing ? "sound" : "sound-off"} className="shell-nav__icon" />
        <span className="shell-nav__link-text--secondary">Music</span>
      </button>
      <span id="theme-music-status" className="visually-hidden" role="status">
        {failed ? "The theme music could not be loaded. Press Music to try again." : ""}
      </span>
      {/* No captions track: the songs are instrumental, with no words to caption. */}
      <audio ref={audioRef} src={song.src} preload="none" />
    </>
  );
}
