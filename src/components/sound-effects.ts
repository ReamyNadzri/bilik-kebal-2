/**
 * Short sound effects that go with the motion: the gunshot page transition,
 * the capture poster (a claim submitted) and the share poster.
 *
 * They play through the theme music's AudioContext, which
 * `ThemeMusicProvider` attaches here. The Music toggle mutes the theme only:
 * the context keeps running for the effects. With the tab hidden, or before
 * the visitor has let the page make sound, it is not running and effects stay
 * silent.
 * Callers play an effect only when its animation actually runs, so reduced
 * motion and the gunshot toggle silence them too.
 *
 * Sound never carries information: every effect doubles an animation, and the
 * page says the same thing in words.
 *
 * Provisional audio, like the theme: the designer's handoff may replace the
 * files in `SOUND_EFFECTS`.
 */
export const SOUND_EFFECTS = {
  gunshot: "/audio/vaultix-sfx-gunshot.mp3",
  capture: "/audio/vaultix-sfx-capture.mp3",
  share: "/audio/vaultix-sfx-share.mp3",
} as const;
export type SoundEffect = keyof typeof SOUND_EFFECTS;

const EFFECT_VOLUME = 0.5;
/**
 * An effect whose file arrives late starts that far in, to stay in step with
 * its animation; past this many seconds it is dropped instead.
 */
const MAX_LATE_SECONDS = 0.25;

interface Bus {
  readonly context: AudioContext;
  readonly output: GainNode;
  readonly buffers: Map<SoundEffect, Promise<AudioBuffer>>;
}

let bus: Bus | null = null;

/** Routes effects through `context`. Returns the function that detaches it again. */
export function attachSoundEffects(context: AudioContext): () => void {
  const output = context.createGain();
  output.gain.value = EFFECT_VOLUME;
  output.connect(context.destination);
  const attached: Bus = { context, output, buffers: new Map() };
  bus = attached;
  return () => {
    if (bus === attached) bus = null;
    output.disconnect();
  };
}

function load(attached: Bus, name: SoundEffect): Promise<AudioBuffer> {
  const cached = attached.buffers.get(name);
  if (cached !== undefined) return cached;
  const pending = fetch(SOUND_EFFECTS[name])
    .then((response) => {
      if (!response.ok) throw new Error(`The ${name} effect answered ${response.status}`);
      return response.arrayBuffer();
    })
    .then((data) => attached.context.decodeAudioData(data));
  // A failed load is forgotten, so the next play tries again.
  pending.catch(() => {
    if (attached.buffers.get(name) === pending) attached.buffers.delete(name);
  });
  attached.buffers.set(name, pending);
  return pending;
}

/** Fetches every effect ahead of time, so the first one is not late. */
export function preloadSoundEffects(): void {
  const attached = bus;
  if (attached === null) return;
  for (const name of Object.keys(SOUND_EFFECTS) as SoundEffect[]) {
    load(attached, name).catch(() => undefined);
  }
}

/** Plays `name` now if sound is on; otherwise does nothing. */
export function playSoundEffect(name: SoundEffect): void {
  const attached = bus;
  if (attached === null || attached.context.state !== "running") return;
  const asked = attached.context.currentTime;
  load(attached, name)
    .then((buffer) => {
      if (bus !== attached || attached.context.state !== "running") return;
      const late = Math.max(0, attached.context.currentTime - asked);
      if (late > MAX_LATE_SECONDS) return;
      const source = attached.context.createBufferSource();
      source.buffer = buffer;
      source.connect(attached.output);
      source.start(0, late);
    })
    .catch(() => undefined);
}
