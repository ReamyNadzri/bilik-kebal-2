import {
  SOUND_EFFECTS,
  attachSoundEffects,
  playSoundEffect,
  preloadSoundEffects,
} from "./sound-effects";

/** Just enough of an AudioContext: a clock, a state, and the sources it starts. */
function fakeContext(state: AudioContextState = "running") {
  const started: Array<{ buffer: unknown; offset: number | undefined }> = [];
  const context = {
    state,
    currentTime: 5,
    destination: {},
    createGain: () => ({ gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() }),
    createBufferSource: () => {
      const source = {
        buffer: null as unknown,
        connect: vi.fn(),
        start: vi.fn((_when: number, offset?: number) => {
          started.push({ buffer: source.buffer, offset });
        }),
      };
      return source;
    },
    decodeAudioData: vi.fn(async (data: ArrayBuffer) => ({ decodedFrom: data.byteLength })),
  };
  return { context, started, asContext: context as unknown as AudioContext };
}

interface FakeResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly arrayBuffer: () => Promise<ArrayBuffer>;
}

const fetchMock = vi.fn<(url: string) => Promise<FakeResponse>>(async () => ({
  ok: true,
  status: 200,
  arrayBuffer: async () => new ArrayBuffer(4),
}));

let detach: (() => void) | null = null;

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  detach?.();
  detach = null;
  vi.unstubAllGlobals();
});

/** Lets the fetch and decode promises settle. */
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test("is silent, and fetches nothing, before the music has given it a context", async () => {
  playSoundEffect("gunshot");
  await settle();

  expect(fetchMock).not.toHaveBeenCalled();
});

test("plays an effect from its start when sound is on", async () => {
  const { asContext, started } = fakeContext();
  detach = attachSoundEffects(asContext);

  playSoundEffect("gunshot");
  await settle();

  expect(fetchMock).toHaveBeenCalledExactlyOnceWith(SOUND_EFFECTS.gunshot);
  expect(started).toEqual([{ buffer: { decodedFrom: 4 }, offset: 0 }]);
});

test("is silent while the music is off, the tab hidden, or sound not yet allowed", async () => {
  const { asContext, started } = fakeContext("suspended");
  detach = attachSoundEffects(asContext);

  playSoundEffect("capture");
  await settle();

  expect(started).toHaveLength(0);
  expect(fetchMock).not.toHaveBeenCalled();
});

test("a file that arrives late starts that far in, to stay in step with the animation", async () => {
  const { context, asContext, started } = fakeContext();
  detach = attachSoundEffects(asContext);
  let arrive: () => void = () => undefined;
  fetchMock.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        arrive = () =>
          resolve({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(4) });
      }),
  );

  playSoundEffect("capture");
  context.currentTime += 0.1;
  arrive();
  await settle();

  expect(started[0]?.offset).toBeCloseTo(0.1);
});

test("drops an effect that would start too far out of step", async () => {
  const { context, asContext, started } = fakeContext();
  detach = attachSoundEffects(asContext);
  let arrive: () => void = () => undefined;
  fetchMock.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        arrive = () =>
          resolve({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(4) });
      }),
  );

  playSoundEffect("share");
  context.currentTime += 0.5;
  arrive();
  await settle();

  expect(started).toHaveLength(0);
});

test("preloads every effect once, and plays them again without refetching", async () => {
  const { asContext, started } = fakeContext();
  detach = attachSoundEffects(asContext);

  preloadSoundEffects();
  await settle();
  playSoundEffect("gunshot");
  playSoundEffect("gunshot");
  await settle();

  expect(fetchMock.mock.calls.map(([url]) => url).sort()).toEqual(
    Object.values(SOUND_EFFECTS).sort(),
  );
  expect(started).toHaveLength(2);
});

test("tries a failed file again on the next play", async () => {
  const { asContext, started } = fakeContext();
  detach = attachSoundEffects(asContext);
  fetchMock.mockImplementationOnce(async () => ({
    ok: false,
    status: 500,
    arrayBuffer: async () => new ArrayBuffer(0),
  }));

  playSoundEffect("gunshot");
  await settle();
  expect(started).toHaveLength(0);

  playSoundEffect("gunshot");
  await settle();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(started).toHaveLength(1);
});

test("stops playing once detached", async () => {
  const { asContext, started } = fakeContext();
  attachSoundEffects(asContext)();

  playSoundEffect("gunshot");
  await settle();

  expect(started).toHaveLength(0);
});
