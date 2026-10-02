import { expect, test } from "vitest";
import { notificationHref, notificationKinds, notificationMessages } from "./notifications";

test("includes the welcome and Sheriff alert kinds", () => {
  expect(notificationKinds).toContain("welcome");
  expect(notificationKinds).toContain("institution_verification_submitted");
});

test("every kind has a generic in-app message", () => {
  for (const kind of notificationKinds) {
    expect(notificationMessages[kind].length).toBeGreaterThan(10);
  }
});

test("the Sheriff alert opens the review queue, the student outcome their profile", () => {
  expect(notificationHref("institution_verification_submitted", "x")).toBe("/console");
  expect(notificationHref("institution_verification_approved", "x")).toBe("/profile");
});

test("a hidden-message notice opens the request it is about", () => {
  expect(notificationKinds).toContain("wanted_reply_hidden");
  expect(notificationHref("wanted_reply_hidden", "abc")).toBe("/wanted/abc");
  // Never the message text or who hid it.
  expect(notificationMessages.wanted_reply_hidden).not.toMatch(/reason|by /i);
});

test("a refund notice tells the Backer their refund is queued and opens their backings", () => {
  expect(notificationKinds).toContain("wanted_refund_queued");
  expect(notificationMessages.wanted_refund_queued).toMatch(/refund/i);
  expect(notificationHref("wanted_refund_queued", "abc")).toBe("/profile#profile-backed-heading");
  // No amounts or other Backers in a notice.
  expect(notificationMessages.wanted_refund_queued).not.toMatch(/RM|\d/);
});

test("the staff refund notice opens the refund queue", () => {
  expect(notificationKinds).toContain("refund_queue_pending");
  expect(notificationMessages.refund_queue_pending).toMatch(/[Rr]efund/);
  expect(notificationHref("refund_queue_pending", "abc")).toBe("/console/operations?tab=refunds");
});
