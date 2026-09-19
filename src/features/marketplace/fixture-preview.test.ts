import { fixtureNow, readPreviewState } from "./fixture-preview";

describe("the development preview parameter", () => {
  test("recognises the two states a fixture cannot otherwise reach", () => {
    expect(readPreviewState("unavailable")).toBe("unavailable");
    expect(readPreviewState("empty")).toBe("empty");
  });

  test("ignores anything else, so a crafted URL cannot invent a state", () => {
    expect(readPreviewState("published")).toBeNull();
    expect(readPreviewState(undefined)).toBeNull();
    expect(readPreviewState([])).toBeNull();
  });

  test("reads the first value when a parameter is repeated", () => {
    expect(readPreviewState(["empty", "unavailable"])).toBe("empty");
  });

  test("answers nothing in a production build, whatever the URL says", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(readPreviewState("unavailable")).toBeNull();
    expect(readPreviewState("empty")).toBeNull();

    vi.unstubAllEnvs();
  });
});

describe("the fixture reference instant", () => {
  test("is a fixed literal, so a fixture-backed screen renders the same twice", () => {
    expect(fixtureNow()).toBe(fixtureNow());
    expect(Number.isNaN(Date.parse(fixtureNow()))).toBe(false);
  });
});
