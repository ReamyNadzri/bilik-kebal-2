import { describe, expect, test } from "vitest";
import { EMBLEM_DRAWINGS, PIXEL_PALETTE, PRESET_PICTURES } from "./pixel-drawings";
import { WANTED_PICTURE_PRESET_COUNT } from "@/contracts/wanted-pictures";

const allowed = new RegExp(`^[ .${Object.keys(PIXEL_PALETTE).join("")}]{16}$`);

describe("pixel drawings", () => {
  test("there are exactly as many pictures as the database accepts", () => {
    expect(PRESET_PICTURES).toHaveLength(WANTED_PICTURE_PRESET_COUNT);
  });

  test("every picture has a unique name", () => {
    expect(new Set(PRESET_PICTURES.map((p) => p.name)).size).toBe(PRESET_PICTURES.length);
  });

  test.each([
    ...PRESET_PICTURES.map((p) => [p.name, p.rows] as const),
    ...Object.entries(EMBLEM_DRAWINGS),
  ])("%s is 16 by 16 and uses only palette colours", (_name, rows) => {
    expect(rows).toHaveLength(16);
    for (const row of rows) expect(row).toMatch(allowed);
  });
});
