import { act, fireEvent, render, screen } from "@testing-library/react";
import { attachSoundEffects, preloadSoundEffects } from "./sound-effects";
import { THEME_PREFERENCE_KEY, THEME_TRACK, ThemeMusic } from "./theme-music";

const detachEffects = vi.hoisted(() => vi.fn());
vi.mock("./sound-effects", () => ({
  attachSoundEffects: vi.fn(() => detachEffects),
  preloadSoundEffects: vi.fn(),
}));

/**
 * jsdom has no Web Audio, so a fake context stands in: `allowed` is the
 * browser's autoplay policy (a refused `resume()` stays pending, as it does in
 * Chrome), `active` is whether the visitor has already interacted with the
 * page, and `fetchOk` decides whether the file arrives.
 */
const audio = vi.hoisted(() => ({
  allowed: false,
  active: false,
  fetchOk: true,
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

class FakeSource {
  buffer: unknown = null;
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  connect = vi.fn();
  start = vi.fn();
}

class FakeAudioContext extends EventTarget {
  state: "suspended" | "running" | "closed" = "suspended";
  currentTime = 10;
  destination = {};
  gainNode = { gain: new FakeParam(), connect: vi.fn() };
  sources: FakeSource[] = [];

  constructor() {
    super();
    audio.contexts.push(this);
  }

  createGain() {
    return this.gainNode;
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

  decodeAudioData() {
    return Promise.resolve({ duration: 122 });
  }

  private setState(state: FakeAudioContext["state"]) {
    if (this.state === state) return;
    this.state = state;
    this.dispatchEvent(new Event("statechange"));
  }
}

const fetchMock = vi.fn(async () =>
  audio.fetchOk
    ? { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(8) }
    : { ok: false, status: 500, arrayBuffer: async () => new ArrayBuffer(0) },
);

beforeEach(() => {
  audio.allowed = false;
  audio.active = false;
  audio.fetchOk = true;
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

test("loops the one theme without a gap, between the loop points inside the file", async () => {
  audio.active = true;
  audio.allowed = true;
  await renderMusic();

  expect(fetchMock).toHaveBeenCalledWith(THEME_TRACK.src);
  expect(context().sources).toHaveLength(1);
  const [source] = context().sources;
  expect(source).toMatchObject({
    loop: true,
    loopStart: THEME_TRACK.loopStart,
    loopEnd: THEME_TRACK.loopEnd,
  });
  expect(source?.start).toHaveBeenCalledWith(0, THEME_TRACK.loopStart);
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
  expect(fetchMock).toHaveBeenCalledTimes(1);
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

test("turning it off stops the theme and is remembered on the next visit", async () => {
  audio.active = true;
  audio.allowed = true;
  const { unmount } = await renderMusic();

  await act(async () => {
    fireEvent.click(toggle());
  });

  expect(toggle()).toHaveAttribute("aria-pressed", "false");
  expect(context().state).toBe("suspended");
  expect(window.localStorage.getItem(THEME_PREFERENCE_KEY)).toBe("off");

  unmount();
  const created = audio.contexts.length;
  await renderMusic();
  await act(async () => {
    fireEvent.pointerDown(document.body);
  });

  expect(audio.contexts).toHaveLength(created);
  expect(toggle()).toHaveAttribute("aria-pressed", "false");
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
  expect(fetchMock).toHaveBeenCalledTimes(1);
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
  expect(audio.contexts).toHaveLength(0);

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
  expect(toggle()).toHaveAttribute("aria-pressed", "false");
  expect(context().state).toBe("suspended");

  hidden.mockReturnValue(false);
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(toggle()).toHaveAttribute("aria-pressed", "true");
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

  expect(fetchMock).toHaveBeenCalledTimes(2);
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
