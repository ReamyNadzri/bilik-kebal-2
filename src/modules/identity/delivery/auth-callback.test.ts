import { describe, expect, test } from "vitest";

import { resolveAuthCallbackPath } from "./auth-callback";

describe("resolveAuthCallbackPath", () => {
  test("routes email confirmation success to the verification result screen", () => {
    expect(resolveAuthCallbackPath({ errorCode: null, otpType: "email", next: "/profile" })).toBe(
      "/verify-email?status=verified",
    );
  });

  test("distinguishes expired email links from invalid links", () => {
    expect(
      resolveAuthCallbackPath({ errorCode: "otp_expired", otpType: "email", next: "/profile" }),
    ).toBe("/verify-email?status=expired");
    expect(
      resolveAuthCallbackPath({
        errorCode: "flow_state_expired",
        otpType: null,
        next: "/profile",
      }),
    ).toBe("/verify-email?status=expired");
    expect(
      resolveAuthCallbackPath({ errorCode: "bad_jwt", otpType: "email", next: "/profile" }),
    ).toBe("/verify-email?status=invalid");
  });

  test("keeps recovery callbacks on their requested destination", () => {
    expect(
      resolveAuthCallbackPath({ errorCode: null, otpType: "recovery", next: "/reset-password" }),
    ).toBe("/reset-password");
  });
});
