import { describe, expect, test } from "vitest";
import { coverRect, posterize } from "./pixelate";

describe("posterize", () => {
  test("rounds each colour channel to the nearest step and leaves alpha alone", () => {
    const data = new Uint8ClampedArray([10, 100, 200, 77, 250, 130, 64, 255]);
    posterize(data, 5); // steps: 0, 63.75, 127.5, 191.25, 255
    expect([...data]).toEqual([0, 128, 191, 77, 255, 128, 64, 255]);
  });

  test("does nothing with fewer than two levels", () => {
    const data = new Uint8ClampedArray([10, 20, 30, 40]);
    expect([...posterize(data, 1)]).toEqual([10, 20, 30, 40]);
  });
});

describe("coverRect", () => {
  test("covers the square with a wide image, centred", () => {
    expect(coverRect(400, 200, { zoom: 1, x: 0, y: 0 }, 100)).toEqual({
      x: -50,
      y: 0,
      width: 200,
      height: 100,
    });
  });

  test("zooms about the centre and shifts by a fraction of the edge", () => {
    expect(coverRect(100, 100, { zoom: 2, x: 0.1, y: -0.1 }, 100)).toEqual({
      x: -40,
      y: -60,
      width: 200,
      height: 200,
    });
  });
});
