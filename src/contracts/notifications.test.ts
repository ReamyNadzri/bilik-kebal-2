import { expect, test } from "vitest";
import { notificationKinds, notificationMessages } from "./notifications";

test("includes the welcome and Sheriff alert kinds", () => {
  expect(notificationKinds).toContain("welcome");
  expect(notificationKinds).toContain("institution_verification_submitted");
});

test("every kind has a generic in-app message", () => {
  for (const kind of notificationKinds) {
    expect(notificationMessages[kind].length).toBeGreaterThan(10);
  }
});
