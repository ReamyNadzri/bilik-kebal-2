import { act, renderHook } from "@testing-library/react";
import type { RefObject } from "react";
import { measureShareFit, useShareFit } from "./use-share-fit";

const POSTER_H = 640;
const CAPTION_H = 260;

function stubViewport(width: number, height: number) {
  vi.stubGlobal("innerWidth", width);
  vi.stubGlobal("innerHeight", height);
}

function elementOfHeight(height: number): RefObject<HTMLElement | null> {
  const element = document.createElement("div");
  Object.defineProperty(element, "offsetHeight", { configurable: true, value: height });
  return { current: element };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("measureShareFit", () => {
  test.each([
    [1280, 720, { side: true, tight: false, padV: 28 }],
    [390, 844, { side: false, tight: true, padV: 16 }],
    [800, 600, { side: true, tight: true, padV: 16 }],
    // Wide enough, but not wider than 0.95 × the height: stacked.
    [768, 1024, { side: false, tight: true, padV: 16 }],
  ])("%i×%i lays out as %o", (vw, vh, expected) => {
    expect(measureShareFit(vw, vh, POSTER_H, CAPTION_H)).toMatchObject(expected);
  });

  test.each([
    [360, 640],
    [390, 844],
    [667, 375],
    [768, 1024],
    [1024, 768],
    [1280, 720],
    [1440, 900],
    [200, 200],
    [4000, 3000],
  ])("keeps the scale within 0.36–1 at %i×%i", (vw, vh) => {
    const { scale } = measureShareFit(vw, vh, POSTER_H, CAPTION_H);
    expect(scale).toBeGreaterThanOrEqual(0.36);
    expect(scale).toBeLessThanOrEqual(1);
  });

  test("scales a stacked poster into the height the caption leaves", () => {
    // 640 − 2 × 16 − 8 − 260 − 18 = 322 px for a 640 px poster.
    expect(measureShareFit(360, 640, POSTER_H, CAPTION_H).scale).toBeCloseTo(322 / 640);
  });

  test("scales a side-by-side poster by the narrower of height and width", () => {
    // Height: 720 − 56 − 8 = 656 of 640, so 1; width: 1280 − 400 − 44 − 32 = 804 of 420, so 1.
    expect(measureShareFit(1280, 720, POSTER_H, CAPTION_H).scale).toBe(1);
    // Width: 800 − 476 = 324 of 420.
    expect(measureShareFit(800, 600, POSTER_H, CAPTION_H).scale).toBeCloseTo(324 / 420);
  });

  test("sets a short landscape phone side by side when stacking cannot fit", () => {
    // Stacked: (375 − 40 − 260 − 18) / 640 is below 0.36. Beside: 191 / 420 of the width.
    expect(measureShareFit(667, 375, POSTER_H, CAPTION_H)).toMatchObject({
      side: true,
      tight: true,
    });
    expect(measureShareFit(667, 375, POSTER_H, CAPTION_H).scale).toBeCloseTo(191 / 420);
    // A portrait phone keeps the stacked layout, whatever the scale.
    expect(measureShareFit(360, 400, POSTER_H, CAPTION_H).side).toBe(false);
  });

  test("does not divide by a poster that has not been measured yet", () => {
    expect(measureShareFit(1280, 720, 0, 0).scale).toBe(1);
  });
});

describe("useShareFit", () => {
  test("measures the sheet and caption against the window", () => {
    stubViewport(1280, 720);
    const { result } = renderHook(() =>
      useShareFit(elementOfHeight(POSTER_H), elementOfHeight(CAPTION_H)),
    );
    expect(result.current).toMatchObject({ side: true, tight: false, posterH: POSTER_H });
  });

  test("measures again when the window is resized or rotated", () => {
    stubViewport(1280, 720);
    const sheet = elementOfHeight(POSTER_H);
    const caption = elementOfHeight(CAPTION_H);
    const { result } = renderHook(() => useShareFit(sheet, caption));

    stubViewport(390, 844);
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toMatchObject({ side: false, tight: true });

    stubViewport(844, 390);
    act(() => {
      window.dispatchEvent(new Event("orientationchange"));
    });
    expect(result.current).toMatchObject({ side: true, tight: true });
  });
});
