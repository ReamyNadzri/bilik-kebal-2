import { describe, expect, it } from "vitest";
import {
  centreOutCells,
  flipOutDuration,
  posterKey,
  posterLook,
  posterMotion,
  wallColumns,
  wallZIndex,
} from "./hunters-wall-layout";

describe("wallColumns", () => {
  it.each([
    [359, 2],
    [559, 2],
    [560, 3],
    [819, 3],
    [820, 4],
    [1119, 4],
    [1120, 5],
    [1920, 5],
  ])("fits %ipx with %i columns", (width, columns) => {
    expect(wallColumns(20, width)).toBe(columns);
  });

  it("never has more columns than posters", () => {
    expect(wallColumns(3, 1440)).toBe(3);
    expect(wallColumns(0, 1440)).toBe(1);
  });
});

describe("centreOutCells", () => {
  it("puts the first poster in the centre cell", () => {
    const cells = centreOutCells(15, 5);

    expect(cells[0]).toEqual({ column: 3, row: 2, vx: 0, vy: 0 });
  });

  it("uses each cell once and leaves corners empty on a short page", () => {
    const cells = centreOutCells(13, 5);
    const keys = cells.map((cell) => `${cell.column},${cell.row}`);

    expect(new Set(keys).size).toBe(13);
    expect(keys).not.toContain("5,1");
    expect(keys).not.toContain("5,3");
  });

  it("grows wider before taller", () => {
    const cells = centreOutCells(15, 5);

    // The neighbours beside the centre come before the ones above and below.
    expect(cells[1]?.row).toBe(cells[0]?.row);
  });

  it("returns nothing for an empty page", () => {
    expect(centreOutCells(0, 5)).toEqual([]);
  });
});

describe("posterKey and posterLook", () => {
  it("is stable for the same member and varies between members", () => {
    const id = "11111111-1111-4111-8111-111111111111";

    expect(posterKey(id)).toBe(posterKey(id));
    expect(posterKey(id)).not.toBe(posterKey("22222222-2222-4222-8222-222222222222"));
    expect(posterKey(id)).toBeGreaterThanOrEqual(1);
    expect(posterKey(id)).toBeLessThanOrEqual(997);
  });

  it("follows the handoff's formulas", () => {
    expect(posterLook(4)).toEqual({
      rotate: 0,
      dx: 3,
      dy: 6,
      creaseAngle: 122,
      stainX: 68,
      stainY: 64,
      fixing: "pin",
    });
    expect(posterLook(3).fixing).toBe("tape");
  });

  it("barely tilts and never shifts on a flat grid", () => {
    const look = posterLook(7, true);

    expect(look.dx).toBe(0);
    expect(look.dy).toBe(0);
    expect(Math.abs(look.rotate)).toBeLessThanOrEqual(2);
  });

  it("stacks the centre on top", () => {
    expect(wallZIndex(0, 5)).toBeGreaterThan(wallZIndex(10, 5));
  });
});

describe("posterMotion", () => {
  const cell = { column: 1, row: 1, vx: -2, vy: -1 };
  const look = posterLook(5);

  it("collapses toward the centre with no transition before growing", () => {
    const motion = posterMotion("pre", { index: 3, count: 10, key: 5, cell, look });

    expect(motion.transform).toContain("translate(200%, 110%)");
    expect(motion.transform).toContain("scale(0.35)");
    expect(motion.opacity).toBe(0);
    expect(motion.transition).toBe("none");
  });

  it("lands staggered from the centre outward", () => {
    const motion = posterMotion("in", { index: 3, count: 10, key: 5, cell, look });

    expect(motion.transform).toBe(
      `translate(${look.dx}px, ${look.dy}px) rotate(${look.rotate}deg)`,
    );
    expect(motion.transition).toContain("165ms");
    expect(motion.opacity).toBe(1);
  });

  it("flies off with the outer edge leaving first", () => {
    const outer = posterMotion("out", { index: 9, count: 10, key: 5, cell, look });
    const centre = posterMotion("out", { index: 0, count: 10, key: 5, cell, look });

    expect(outer.transition).toContain(" 0ms");
    expect(centre.transition).toContain(" 198ms");
    expect(outer.opacity).toBe(0);
  });

  it("waits for the slowest poster before the next page", () => {
    expect(flipOutDuration(10)).toBe(780);
    expect(flipOutDuration(20)).toBe(1000);
  });
});
