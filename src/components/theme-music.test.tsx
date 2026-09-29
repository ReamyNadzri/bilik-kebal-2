import { act, fireEvent, render, screen } from "@testing-library/react";
import { THEME_PREFERENCE_KEY, THEME_TRACKS, ThemeMusic } from "./theme-music";

/**
 * jsdom has no media playback, so the element is driven by hand: `allowed`
 * stands in for the browser's autoplay policy, and play/pause flip `paused`
 * and fire the events a real element would.
 */
const media = vi.hoisted(() => ({ allowed: false, paused: true }));

beforeEach(() => {
  media.allowed = false;
  media.paused = true;
  window.localStorage.clear();
  vi.spyOn(HTMLMediaElement.prototype, "paused", "get").mockImplementation(() => media.paused);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    if (!media.allowed) return Promise.reject(new DOMException("Blocked", "NotAllowedError"));
    media.paused = false;
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    media.paused = true;
    this.dispatchEvent(new Event("pause"));
  });
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
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

test("offers a Music toggle and does not fetch the file until it plays", async () => {
  const { container } = await renderMusic();

  expect(toggle()).toHaveAttribute("aria-pressed", "false");
  const audio = container.querySelector("audio");
  expect(audio).toHaveAttribute("src", THEME_TRACKS[0].src);
  expect(audio).toHaveAttribute("preload", "none");
});

test("plays the three songs in turn and comes back to the theme after the last", async () => {
  media.allowed = true;
  const { container } = await renderMusic();
  const audio = container.querySelector("audio");

  for (const next of [1, 2, 0]) {
    const plays = vi.mocked(HTMLMediaElement.prototype.play).mock.calls.length;
    await act(async () => {
      media.paused = true;
      audio?.dispatchEvent(new Event("ended"));
    });

    expect(audio).toHaveAttribute("src", THEME_TRACKS[next]?.src);
    expect(vi.mocked(HTMLMediaElement.prototype.play).mock.calls.length).toBe(plays + 1);
    expect(toggle()).toHaveAttribute("aria-pressed", "true");
  }
});

test("plays straight away when the browser allows it", async () => {
  media.allowed = true;
  await renderMusic();

  expect(toggle()).toHaveAttribute("aria-pressed", "true");
});

test("starts on the first interaction when the browser blocks autoplay", async () => {
  await renderMusic();
  expect(toggle()).toHaveAttribute("aria-pressed", "false");

  media.allowed = true;
  await act(async () => {
    fireEvent.pointerDown(document.body);
  });

  expect(toggle()).toHaveAttribute("aria-pressed", "true");
});

test("does not start on Escape, which is not a gesture that unlocks sound", async () => {
  await renderMusic();
  media.allowed = true;

  await act(async () => {
    fireEvent.keyDown(document.body, { key: "Escape" });
  });

  expect(toggle()).toHaveAttribute("aria-pressed", "false");
});

test("pressing Music while autoplay is blocked starts the theme instead of turning it off", async () => {
  await renderMusic();
  media.allowed = true;

  await act(async () => {
    fireEvent.pointerDown(toggle());
    fireEvent.click(toggle());
  });

  expect(toggle()).toHaveAttribute("aria-pressed", "true");
  expect(HTMLMediaElement.prototype.pause).not.toHaveBeenCalled();
});

test("turning it off stops the theme and is remembered on the next visit", async () => {
  media.allowed = true;
  const { unmount } = await renderMusic();

  await act(async () => {
    fireEvent.click(toggle());
  });

  expect(toggle()).toHaveAttribute("aria-pressed", "false");
  expect(window.localStorage.getItem(THEME_PREFERENCE_KEY)).toBe("off");

  unmount();
  vi.mocked(HTMLMediaElement.prototype.play).mockClear();
  await renderMusic();
  await act(async () => {
    fireEvent.pointerDown(document.body);
  });

  expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  expect(toggle()).toHaveAttribute("aria-pressed", "false");
});

test("a later interaction does not restart it after the visitor turned it off", async () => {
  await renderMusic();
  media.allowed = true;
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
  media.allowed = true;
  await renderMusic();
  expect(toggle()).toHaveAttribute("aria-pressed", "false");

  await act(async () => {
    fireEvent.click(toggle());
  });

  expect(toggle()).toHaveAttribute("aria-pressed", "true");
  expect(window.localStorage.getItem(THEME_PREFERENCE_KEY)).toBe("on");
});

test("pauses while the tab is hidden and resumes when it returns", async () => {
  media.allowed = true;
  await renderMusic();
  const hidden = vi.spyOn(document, "hidden", "get");

  hidden.mockReturnValue(true);
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(toggle()).toHaveAttribute("aria-pressed", "false");

  hidden.mockReturnValue(false);
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(toggle()).toHaveAttribute("aria-pressed", "true");
});

test("says so when the file cannot be loaded, and pressing Music tries again", async () => {
  media.allowed = true;
  const { container } = await renderMusic();
  const audio = container.querySelector("audio");

  await act(async () => {
    media.paused = true;
    audio?.dispatchEvent(new Event("error"));
  });

  expect(screen.getByRole("status")).toHaveTextContent("The theme music could not be loaded.");
  expect(toggle()).toHaveAttribute("aria-pressed", "false");

  await act(async () => {
    fireEvent.click(toggle());
  });

  expect(HTMLMediaElement.prototype.load).toHaveBeenCalled();
  expect(toggle()).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
});

test("still works when the browser refuses storage", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("denied");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("denied");
  });
  media.allowed = true;
  await renderMusic();
  expect(toggle()).toHaveAttribute("aria-pressed", "true");

  await act(async () => {
    fireEvent.click(toggle());
  });

  expect(toggle()).toHaveAttribute("aria-pressed", "false");
});

test("the fade-in never sets a negative volume when a frame is stamped before the fade began", async () => {
  // A browser stamps each animation frame with the time the frame began, which
  // can be a moment before the fade read the clock.
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frames.push(callback);
    return frames.length;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
  vi.spyOn(performance, "now").mockReturnValue(1000);
  media.allowed = true;
  const { container } = await renderMusic();
  const audio = container.querySelector("audio") as HTMLAudioElement;

  act(() => frames.shift()?.(999));
  expect(audio.volume).toBe(0);

  act(() => frames.shift()?.(1000 + 1500));
  expect(audio.volume).toBeCloseTo(0.45);
});
