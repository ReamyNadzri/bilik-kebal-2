import { describe, expect, test } from "vitest";

import { decodePendingEmail, encodePendingEmail } from "./pending-verification-cookie";

describe("pending verification cookie", () => {
  test("round-trips a normalized email through a signed value", async () => {
    const value = await encodePendingEmail("Aina@Example.COM", "a".repeat(32));
    await expect(decodePendingEmail(value, "a".repeat(32))).resolves.toBe("aina@example.com");
  });

  test("rejects a value whose signature was changed", async () => {
    const value = await encodePendingEmail("aina@example.com", "a".repeat(32));
    await expect(decodePendingEmail(`${value}x`, "a".repeat(32))).resolves.toBeNull();
  });
});
