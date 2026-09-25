import { describe, expect, it } from "vitest";
import { idlePhase, IDLE_WARNING_MS, STAFF_IDLE_MS } from "./idle-policy";

describe("idlePhase", () => {
  it("warns staff 2 minutes before the 30-minute limit, then expires", () => {
    expect(idlePhase(STAFF_IDLE_MS - IDLE_WARNING_MS - 1, STAFF_IDLE_MS, true)).toBe("active");
    expect(idlePhase(STAFF_IDLE_MS - IDLE_WARNING_MS, STAFF_IDLE_MS, true)).toBe("warning");
    expect(idlePhase(STAFF_IDLE_MS, STAFF_IDLE_MS, true)).toBe("expired");
  });

  it("never warns when warnings are off", () => {
    expect(idlePhase(STAFF_IDLE_MS - 1, STAFF_IDLE_MS, false)).toBe("active");
  });
});
