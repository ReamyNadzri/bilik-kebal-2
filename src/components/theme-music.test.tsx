import { act, fireEvent, render, screen } from "@testing-library/react";
import { attachSoundEffects, preloadSoundEffects } from "./sound-effects";
import { THEME_PREFERENCE_KEY, THEME_TRACKS, ThemeMusic } from "./theme-music";

const detachEffects = vi.hoisted(() => vi.fn());
vi.mock("./sound-effects", () => ({
  attachSoundEffects: vi.fn(() => detachEffects),
  preloadSoundEffects: vi.fn(),
}));

/**
 * jsdom has no Web Audio, so a fake context stands in: `allowed` is the
 * browser's autoplay policy (a refused `resume()` stays pending, as it does in
 * Chrome), `active` is whether the visitor has already interacted with the
 * page, `fetchOk` decides whether the files arrive and `failing` lists any
 * single file that does not.
 */
const audio = vi.hoisted(() => ({
  allowed: false,
  active: false,
  fetchOk: true,
  failing: new Set<string>(),
  contexts: [] as FakeAudioContext[],
}));

class FakeParam {
  value = 0;
  cancelScheduledValues = vi.fn();
  setValueAtTime = vi.fn((value: number) => {
    this.value = value;
  });
  linearRampToValueAtTime = vi.fn((value: number) => {
    this.value = value;
  });
}

class FakeGain {
  gain = new FakeParam();
  connect = vi.fn();
  disconnect = vi.fn();
}

/** What the fake decoder hands back: which file it came from. */
interface FakeBuffer {
  readonly duration: number;
  readonly src: string;
}

class FakeSource {
  buffer: FakeBuffer | null = null;
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  onended: (() => void) | null = null;
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class FakeAudioContext extends EventTarget {
  state: "suspended" | "running" | "closed" = "suspended";
  currentTime = 10;
  destination = {};
  gains: FakeGain[] = [];
  sources: FakeSource[] = [];

  constructor() {
    super();
    audio.contexts.push(this);
  }

  /** The first gain made is the theme's master; each track's voice gets its own after it. */
  get gainNode() {
    const master = this.gains[0];
    if (master === undefined) throw new Error("No gain was created");
    return master;
  }

  createGain() {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }

  createBufferSource() {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }

  resume() {
    if (!audio.allowed) return new Promise<void>(() => undefined);
    this.setState("running");
    return Promise.resolve();
  }

  suspend() {
    this.setState("suspended");
    return Promise.resolve();
  }

  close() {
    this.setState("closed");
    return Promise.resolve();
  }

  decodeAudioData(data: { src: string }): Promise<FakeBuffer> {
    return Promise.resolve({ duration: 122, src: data.src });
  }

  private setState(state: FakeAudioContext["state"]) {
    if (this.state === state) return;
    this.state = state;
    this.dispatchEvent(new Event("statechange"));
  }
}

const fetchMock = vi.fn(async (src: string) =>
  audio.fetchOk && !audio.failing.has(src)
    ? { ok: true, status: 200, arrayBuffer: async () => ({ src }) }
    : { ok: false, status: 500, arrayBuffer: async () => ({ src }) },
);

function fetchesOf(src: string) {
  return fetchMock.mock.calls.filter(([called]) => called === src).length;
}

beforeEach(() => {
  audio.allowed = false;
  audio.active = false;
  audio.fetchOk = true;
  audio.failing = new Set();
  audio.contexts = [];
  fetchMock.mockClear();
  detachEffects.mockClear();
  vi.mocked(attachSoundEffects).mockClear();
  vi.mocked(preloadSoundEffects).mockClear();
  window.localStorage.clear();
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(navigator, "userActivation", {
    configurable: true,
    get: () => ({ hasBeenActive: audio.active }),
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, "userActivation");
});

async function renderMusic() {
  const view = render(<ThemeMusic />);
  // Let the first play attempt settle.
  await act(async () => {});
  return view;
}

function toggle() {
  return screen.getByRole("button", { name: "Music" });
}

function context() {
  const current = audio.contexts.at(-1);
  if (current === undefined) throw new Error("No audio context was created");
  return current;
}

test("offers a Music toggle and does not fetch the file until it plays", async () => {
  await renderMusic();

  expect(toggle()).toHaveAttribute("aria-pressed", "false");
  expect(fetchMock).not.toHaveBeenCalled();
  expect(audio.contexts).toHaveLength(0);
});

const [THEME, DEAD_OR_ALIVE] = THEME_TRACKS;
const lap = (track: (typeof THEME_TRACKS)[number]) => track.loopEnd - track.loopStart;

/** Moves the fake clock to `seconds` and lets the scheduler look ahead. */
async function playUntil(seconds: number) {
  context().currentTime = seconds;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
}

test("there are two background tracks: the VAULTIX theme, then Dead or Alive", () => {
  expect(THEME_TRACKS.map((track) => track.title)).toEqual(["VAULTIX Theme", "Dead or Alive"]);
});

test("starts with the theme from its loop point, and fetches the next track while it plays", async () => {
  audio.active = true;
  audio.allowed = true;
  await renderMusic();

  expect(context().sources).toHaveLength(1);
  const [source] = context().sources;
  expect(source?.buffer?.src).toBe(THEME.src);
  expect(source?.start).toHaveBeenCalledWith(10, THEME.loopStart);
  expect(fetchesOf(THEME.src)).toBe(1);
  expect(fetchesOf(DEAD_OR_ALIVE.src)).toBe(1);
});

test("hands over to the next track at the end of the lap, crossfading inside the files' margins", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  audio.active = true;
  audio.allowed = true;
  await renderMusic();
  const handover = 10 + lap(THEME);

  await playUntil(handover - 10);
  expect(context().sources).toHaveLength(1); // not yet: it schedules a few seconds ahead

  await playUntil(handover - 4);
  expect(context().sources).toHaveLength(2);
  const [first, second] = context().sources;
  expect(second?.buffer?.src).toBe(DEAD_OR_ALIVE.src);
  // Half a second either side of the handover, inside the second of loop each file carries.
  expect(second?.start).toHaveBeenCalledWith(handover - 0.5, DEAD_OR_ALIVE.loopStart - 0.5);
  expect(first?.stop).toHaveBeenCalledWith(handover + 0.5);
  // The theme gain and the hold gain come first, then one gain per lap.
  const [, , firstVoice, secondVoice] = context().gains;
  expect(firstVoice?.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, handover + 0.5);
  expect(secondVoice?.gain.setValueAtTime).toHaveBeenCalledWith(0, handover - 0.5);
  expect(secondVoice?.gain.linearRampToValueAtTime).toHaveBeenCalledWith(1, handover + 0.5);
});

test("comes back to the theme after the last track", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  audio.active = true;
  audio.allowed = true;
  await renderMusic();
  const first = 10 + lap(THEME);
  const second = first + lap(DEAD_OR_ALIVE);

  await playUntil(first - 4);
  await playUntil(second - 4);

  expect(context().sources).toHaveLength(3);
  const third = context().sources[2];
  expect(third?.buffer?.src).toBe(THEME.src);
  expect(third?.start).toHaveBeenCalledWith(second - 0.5, THEME.loopStart - 0.5);
});

test("when the next track cannot be loaded, the theme goes round again without a gap", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  audio.active = true;
  audio.allowed = true;
  audio.failing.add(DEAD_OR_ALIVE.src);
  await renderMusic();
  const handover = 10 + lap(THEME);

  await playUntil(handover - 4);

  expect(context().sources).toHaveLength(2);
  const again = context().sources[1];
  expect(again?.buffer?.src).toBe(THEME.src);
  expect(again?.start).toHaveBeenCalledWith(handover - 0.5, THEME.loopStart - 0.5);
  // Only the first file's failure is worth telling the visitor about.
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
  expect(toggle()).toHaveAttribute("aria-pressed", "true");
});

test("stops scheduling tracks once the shell unmounts", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  audio.active = true;
  audio.allowed = true;
  const { unmount } = await renderMusic();
  const made = context();

  unmount();
  made.currentTime = 10 + lap(THEME) - 4;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });

  expect(made.sources).toHaveLength(1);
});

test("plays straight away when the visitor has already interacted with the page", async () => {
  audio.active = true;
  audio.allowed = true;
  await renderMusic();

  expect(toggle()).toHaveAttribute("aria-pressed", "true");
});

test("fades in from silence rather than starting at full volume", async () => {
  audio.active = true;
  audio.allowed = true;
  await renderMusic();

  const { gain } = context().gainNode;
  expect(gain.setValueAtTime).toHaveBeenCalledWith(0, 10);
  expect(gain.linearRampToValueAtTime).toHaveBeenCalledWith(0.45, 11.5);
});

test("starts on the first interaction when there has been none yet", async () => {
  await renderMusic();
  expect(toggle()).toHaveAttribute("aria-pressed", "false");

  audio.allowed = true;
  await act(async () => {
    fireEvent.pointerDown(document.body);
  });

  expect(toggle()).toHaveAttribute("aria-pressed", "true");
});

test("waits for the next interaction when the browser still refuses sound", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  audio.active = true;
  await renderMusic();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(400);
  });
  expect(toggle()).toHaveAttribute("aria-pressed", "false");
  expect(fetchMock).not.toHaveBeenCalled();

  audio.allowed = true;
  await act(async () => {
    fireEvent.pointerDown(document.body);
  });

  expect(toggle()).toHaveAttribute("aria-pressed", "true");
});

test("one press that fires several gesture events starts the theme once", async () => {
  await renderMusic();
  audio.allowed = true;

  await act(async () => {
    fireEvent.pointerDown(document.body);
    fireEvent.pointerUp(document.body);
    fireEvent.click(document.body);
  });

  expect(audio.contexts).toHaveLength(1);
  expect(context().sources).toHaveLength(1);
  expect(fetchesOf(THEME.src)).toBe(1);
});

test("does not start on Escape, which is not a gesture that unlocks sound", async () => {
  await renderMusic();
  audio.allowed = true;

  await act(async () => {
    fireEvent.keyDown(document.body, { key: "Escape" });
  });

  expect(toggle()).toHaveAttribute("aria-pressed", "false");
});

test("pressing Music before the theme has started starts it instead of turning it off", async () => {
  await renderMusic();
  audio.allowed = true;

  await act(async () => {
    fireEvent.pointerDown(toggle());
    fireEvent.click(toggle());
  });

  expect(toggle()).toHaveAttribute("aria-pressed", "true");
  expect(context().state).toBe("running");
});

test("turning it off mutes the theme only, and is remembered on the next visit", async () => {
  audio.active = true;
  audio.allowed = true;
  const { unmount } = await renderMusic();

  await act(async () => {
    fireEvent.click(toggle());
  });

  expect(toggle()).toHaveAttribute("aria-pressed", "false");
  // The sound effects share the context, so it keeps running; the theme fades to silence.
  expect(context().state).toBe("running");
  expect(context().gainNode.gain.value).toBe(0);
  expect(window.localStorage.getItem(THEME_PREFERENCE_KEY)).toBe("off");

  unmount();
  fetchMock.mockClear();
  await renderMusic();
  await act(async () => {
    fireEvent.pointerDown(document.body);
  });

  expect(toggle()).toHaveAttribute("aria-pressed", "false");
  // Sound is unlocked for the effects, but the theme is neither fetched nor started.
  expect(context().state).toBe("running");
  expect(context().sources).toHaveLength(0);
  expect(fetchMock).not.toHaveBeenCalled();
});

test("with the music muted, sound effects still have a running context", async () => {
  window.localStorage.setItem(THEME_PREFERENCE_KEY, "off");
  audio.allowed = true;
  await renderMusic();

  await act(async () => {
    fireEvent.pointerDown(document.body);
  });

  expect(attachSoundEffects).toHaveBeenCalledWith(context());
  expect(context().state).toBe("running");
  expect(preloadSoundEffects).toHaveBeenCalled();
  expect(context().sources).toHaveLength(0);
});

test("turning it back on carries on from where it stopped instead of starting over", async () => {
  audio.active = true;
  audio.allowed = true;
  await renderMusic();

  await act(async () => {
    fireEvent.click(toggle());
  });
  await act(async () => {
    fireEvent.click(toggle());
  });

  expect(toggle()).toHaveAttribute("aria-pressed", "true");
  expect(context().state).toBe("running");
  expect(context().sources).toHaveLength(1);
  expect(fetchesOf(THEME.src)).toBe(1);
});

test("a later interaction does not restart it after the visitor turned it off", async () => {
  await renderMusic();
  audio.allowed = true;
  await act(async () => {
    fireEvent.click(toggle());
  });
  await act(async () => {
    fireEvent.click(toggle());
  });
  expect(toggle()).toHaveAttribute("aria-pressed", "false");

  await act(async () => {
    fireEvent.pointerDown(document.body);
  });

  expect(toggle()).toHaveAttribute("aria-pressed", "false");
});

test("turning it back on is remembered too", async () => {
  window.localStorage.setItem(THEME_PREFERENCE_KEY, "off");
  audio.active = true;
  audio.allowed = true;
  await renderMusic();
  expect(toggle()).toHaveAttribute("aria-pressed", "false");
  expect(audio.contexts.every((made) => made.sources.length === 0)).toBe(true);

  await act(async () => {
    fireEvent.click(toggle());
  });

  expect(toggle()).toHaveAttribute("aria-pressed", "true");
  expect(window.localStorage.getItem(THEME_PREFERENCE_KEY)).toBe("on");
});

test("pauses while the tab is hidden and resumes when it returns", async () => {
  audio.active = true;
  audio.allowed = true;
  await renderMusic();
  const hidden = vi.spyOn(document, "hidden", "get");

  hidden.mockReturnValue(true);
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  // Silent while hidden, but still switched on.
  expect(toggle()).toHaveAttribute("aria-pressed", "true");
  expect(context().state).toBe("suspended");

  hidden.mockReturnValue(false);
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(toggle()).toHaveAttribute("aria-pressed", "true");
  expect(context().state).toBe("running");
  expect(context().sources).toHaveLength(1);
});

test("says so when the file cannot be loaded, and pressing Music tries again", async () => {
  audio.active = true;
  audio.allowed = true;
  audio.fetchOk = false;
  await renderMusic();

  expect(screen.getByRole("status")).toHaveTextContent("The theme music could not be loaded.");
  expect(toggle()).toHaveAttribute("aria-pressed", "false");

  audio.fetchOk = true;
  await act(async () => {
    fireEvent.click(toggle());
  });

  expect(fetchesOf(THEME.src)).toBe(2);
  expect(toggle()).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
});

test("says so when the browser has no Web Audio", async () => {
  vi.stubGlobal("AudioContext", undefined);
  await renderMusic();
  audio.allowed = true;

  await act(async () => {
    fireEvent.click(toggle());
  });

  expect(toggle()).toHaveAttribute("aria-pressed", "false");
  expect(screen.getByRole("status")).toHaveTextContent("The theme music could not be loaded.");
});

test("still works when the browser refuses storage", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("denied");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("denied");
  });
  audio.active = true;
  audio.allowed = true;
  await renderMusic();
  expect(toggle()).toHaveAttribute("aria-pressed", "true");

  await act(async () => {
    fireEvent.click(toggle());
  });

  expect(toggle()).toHaveAttribute("aria-pressed", "false");
});

test("lets the audio device go when the shell unmounts", async () => {
  audio.active = true;
  audio.allowed = true;
  const { unmount } = await renderMusic();

  unmount();

  expect(context().state).toBe("closed");
});

test("gives the sound effects the same context, and fetches them once sound is allowed", async () => {
  audio.active = true;
  audio.allowed = true;
  const { unmount } = await renderMusic();

  expect(attachSoundEffects).toHaveBeenCalledExactlyOnceWith(context());
  expect(preloadSoundEffects).toHaveBeenCalled();

  unmount();
  expect(detachEffects).toHaveBeenCalledOnce();
});

test("does not fetch the sound effects while sound is still refused", async () => {
  await renderMusic();

  await act(async () => {
    fireEvent.keyDown(document.body, { key: "Escape" });
  });

  expect(preloadSoundEffects).not.toHaveBeenCalled();
});
