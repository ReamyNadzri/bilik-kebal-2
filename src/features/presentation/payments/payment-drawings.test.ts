import { describe, expect, test } from "vitest";
import { PIXEL_PALETTE } from "../pixel-drawings";
import { PAYMENT_DRAWINGS } from "./payment-drawings";

const allowed = new RegExp(`^[ .${Object.keys(PIXEL_PALETTE).join("")}]{16}$`);

describe("payment drawings", () => {
  test.each(Object.entries(PAYMENT_DRAWINGS))(
    "%s is 16 by 16 and uses only palette colours",
    (_name, rows) => {
      expect(rows).toHaveLength(16);
      for (const row of rows) expect(row).toMatch(allowed);
    },
  );
});
