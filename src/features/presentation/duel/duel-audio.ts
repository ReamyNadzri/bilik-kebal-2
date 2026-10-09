/**
 * The Duel's sound: cues, the announcer, the heartbeat and the lobby music.
 *
 * Every file is fetched and decoded into an AudioBuffer ahead of time, and its
 * leading silence (below 0.02 amplitude) is skipped when it plays, so a cue
 * fires the instant it is asked for. The SHOOT! call lagging the on-screen
 * signal was a real bug in the prototype; this is its fix, kept.
 *
 * A missing file falls back to a synthesised tone, and a missing voice line
 * to the browser's speech synthesis.
 *
 * The music loops only in the lobby, through Web Audio so it has no gap at the
 * lap and can never play twice: there is one engine per page.
 *
 * Sound never carries information on its own: SHOOT! is on screen too, and
 * the timer and result card say everything in words.
 */
export const DUEL_CUES = [
  "intro",
  "vs",
  "ready",
  "steady",
  "signal",
  "fire",
  "foul",
  "fall",
  "win",
  "lose",
  "vo-ready",
  "vo-steady",
  "vo-shoot",
] as const;
export type DuelCue = (typeof DUEL_CUES)[number];
type Voice = "ready" | "steady" | "shoot";

const CUE_PATH = (cue: DuelCue) => `/duel/sfx/${cue}.mp3`;
const MUSIC_PATH = "/duel/duel-theme.mp3";
const MUSIC_VOLUME = 0.3;
const SILENCE = 0.02;

interface Loaded {
  readonly buffer: AudioBuffer;
  /** Seconds of leading silence to skip. */
  readonly offset: number;
}

function createContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Context =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  try {
    return Context === undefined ? null : new Context();
  } catch {
    return null;
  }
}

/** Where the first sound starts, a few samples early so its attack is kept. */
function firstSound(buffer: AudioBuffer): number {
  const data = buffer.getChannelData(0);
  let i = 0;
  while (i < data.length && Math.abs(data[i] ?? 0) < SILENCE) i += 1;
  return Math.max(0, i - 64) / buffer.sampleRate;
}

export class DuelAudio {
  private context: AudioContext | null = null;
  private readonly cues = new Map<DuelCue, Loaded>();
  private loading = false;
  private music: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  private musicBuffer: Promise<AudioBuffer> | null = null;
  private musicWanted = false;

  /** Creates the context on a gesture and starts decoding every cue. */
  unlock(): void {
    this.context ??= createContext();
    const context = this.context;
    if (context === null) return;
    if (context.state === "suspended") context.resume().catch(() => undefined);
    if (!this.loading) {
      this.loading = true;
      for (const cue of DUEL_CUES) {
        fetch(CUE_PATH(cue))
          .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject()))
          .then((data) => context.decodeAudioData(data))
          .then((buffer) => this.cues.set(cue, { buffer, offset: firstSound(buffer) }))
          .catch(() => undefined);
      }
    }
    if (this.musicWanted) this.startMusic();
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.getVoices();
  }

  private playLoaded(loaded: Loaded): boolean {
    const context = this.context;
    if (context === null) return false;
    if (context.state === "suspended") context.resume().catch(() => undefined);
    const source = context.createBufferSource();
    source.buffer = loaded.buffer;
    source.connect(context.destination);
    source.start(0, loaded.offset);
    return true;
  }

  tone(freq: number, seconds: number, type: OscillatorType = "square", volume = 0.12, at = 0) {
    const context = this.context;
    if (context === null || context.state !== "running") return;
    const start = context.currentTime + at;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = freq;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + seconds + 0.02);
  }

  private bang() {
    const context = this.context;
    if (context === null || context.state !== "running") return;
    const n = Math.floor(context.sampleRate * 0.55);
    const buffer = context.createBuffer(1, n, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < n; i += 1) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.value = 1500;
    gain.gain.value = 0.85;
    source.connect(filter).connect(gain).connect(context.destination);
    source.start();
    this.tone(70, 0.25, "sine", 0.5);
  }

  /** Plays a cue from its file, or its synthesised stand-in. */
  cue(cue: Exclude<DuelCue, `vo-${string}`>): void {
    const loaded = this.cues.get(cue);
    if (loaded && this.playLoaded(loaded)) return;
    const arpeggio = (notes: number[], d: number, type: OscillatorType, v: number) =>
      notes.forEach((note, k) => this.tone(note, d, type, v, k * d));
    switch (cue) {
      case "intro":
        arpeggio([440, 523, 659, 880], 0.1, "square", 0.08);
        break;
      case "vs":
        this.tone(220, 0.5, "sawtooth", 0.06);
        this.tone(330, 0.5, "square", 0.05);
        break;
      case "ready":
        this.tone(392, 0.08, "square", 0.06);
        break;
      case "steady":
        this.tone(440, 0.08, "square", 0.06);
        break;
      case "signal":
        this.tone(988, 0.14, "square", 0.14);
        break;
      case "fire":
        this.bang();
        break;
      case "foul":
        this.tone(130, 0.3, "sawtooth", 0.12);
        break;
      case "fall":
        this.tone(90, 0.18, "sine", 0.3);
        break;
      case "win":
        arpeggio([523, 659, 784, 1047], 0.11, "square", 0.08);
        break;
      case "lose":
        arpeggio([392, 330, 262], 0.16, "triangle", 0.12);
        break;
    }
  }

  /** The announcer: the recorded line, or the browser's voice. */
  speak(word: Voice): void {
    const loaded = this.cues.get(`vo-${word}`);
    if (loaded && this.playLoaded(loaded)) return;
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const synthesis = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(
      word === "shoot" ? "Shoot!" : word === "ready" ? "Ready" : "Steady",
    );
    utterance.rate = word === "shoot" ? 1.3 : 0.9;
    utterance.pitch = 0.6;
    const voice = synthesis.getVoices().find((v) => /en[-_](US|GB)/i.test(v.lang));
    if (voice) utterance.voice = voice;
    synthesis.cancel();
    synthesis.speak(utterance);
  }

  /** The palpitation: two thumps, louder as `strength` (0–1) grows. */
  heartbeat(strength: number): void {
    this.tone(58, 0.15, "sine", 0.35 + strength * 0.35);
    this.tone(50, 0.13, "sine", 0.25 + strength * 0.3, 0.17);
  }

  /** The thud as the loser falls. */
  thud(): void {
    this.tone(45, 0.4, "sine", 0.55);
  }

  /** Whether the lobby music should be playing; it starts once sound is unlocked. */
  setMusic(wanted: boolean): void {
    this.musicWanted = wanted;
    if (wanted) this.startMusic();
    else this.stopMusic();
  }

  private startMusic() {
    const context = this.context;
    if (context === null || this.music !== null) return;
    this.musicBuffer ??= fetch(MUSIC_PATH)
      .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject()))
      .then((data) => context.decodeAudioData(data));
    this.musicBuffer
      .then((buffer) => {
        if (!this.musicWanted || this.music !== null || this.context !== context) return;
        const source = context.createBufferSource();
        const gain = context.createGain();
        source.buffer = buffer;
        source.loop = true;
        gain.gain.setValueAtTime(0, context.currentTime);
        gain.gain.linearRampToValueAtTime(MUSIC_VOLUME, context.currentTime + 0.8);
        source.connect(gain).connect(context.destination);
        source.start();
        this.music = { source, gain };
      })
      .catch(() => {
        this.musicBuffer = null;
      });
  }

  /** Stops the music at once, as a duel starts. */
  private stopMusic() {
    const music = this.music;
    this.music = null;
    if (music === null) return;
    try {
      music.source.stop();
    } catch {
      // Already stopped.
    }
    music.source.disconnect();
    music.gain.disconnect();
  }

  /** Quiet while the tab is hidden; back on return. */
  setHidden(hidden: boolean): void {
    const context = this.context;
    if (context === null) return;
    if (hidden) context.suspend().catch(() => undefined);
    else context.resume().catch(() => undefined);
  }

  cancelSpeech(): void {
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
  }

  close(): void {
    this.stopMusic();
    this.cancelSpeech();
    const context = this.context;
    this.context = null;
    void context?.close().catch(() => undefined);
  }
}
