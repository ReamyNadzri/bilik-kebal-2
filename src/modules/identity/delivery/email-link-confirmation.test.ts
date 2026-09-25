import { expect, test } from "vitest";
import { confirmPathFor, parseEmailLinkInput } from "./email-link-confirmation";

test.each([
  [
    { tokenHash: "abc123", type: "email", next: null },
    { tokenHash: "abc123", type: "email", next: "/profile" },
  ],
  [
    { tokenHash: "pkce_ab-C_9", type: "recovery", next: "/x" },
    { tokenHash: "pkce_ab-C_9", type: "recovery", next: "/x" },
  ],
  [
    { tokenHash: "abc", type: "email", next: "//evil.example" },
    { tokenHash: "abc", type: "email", next: "/profile" },
  ],
])("accepts %j", (input, expected) => {
  expect(parseEmailLinkInput(input)).toEqual(expected);
});

test.each([
  { tokenHash: "", type: "email", next: null },
  { tokenHash: "abc", type: "signup", next: null },
  { tokenHash: "abc", type: "magiclink", next: null },
  { tokenHash: "a b", type: "email", next: null },
  { tokenHash: "x".repeat(513), type: "email", next: null },
  { tokenHash: 5, type: "email", next: null },
  { tokenHash: null, type: null, next: null },
])("rejects %j", (input) => {
  expect(parseEmailLinkInput(input)).toBeNull();
});

test("maps outcomes to the existing destinations", () => {
  const email = { tokenHash: "abc", type: "email" as const, next: "/profile" };
  const recovery = { tokenHash: "abc", type: "recovery" as const, next: "/profile" };
  expect(confirmPathFor(email, null)).toBe("/verify-email?status=verified");
  expect(confirmPathFor(email, "otp_expired")).toBe("/verify-email?status=expired");
  expect(confirmPathFor(email, "invalid")).toBe("/verify-email?status=invalid");
  expect(confirmPathFor(recovery, null)).toBe("/reset-password");
  expect(confirmPathFor(recovery, "otp_expired")).toBe("/reset-password?status=expired");
});
