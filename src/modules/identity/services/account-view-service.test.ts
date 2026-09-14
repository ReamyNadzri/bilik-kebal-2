import { describe, expect, test } from "vitest";
import { toAccountViewModel, type AccountRecord } from "./account-view-service";

const base: AccountRecord = {
  displayName: "A Tester",
  emailConfirmedAt: "2026-09-14T00:00:00Z",
  hasActiveRestriction: false,
  hasConsoleAccess: false,
  institution: { id: "00000000-0000-4000-8000-000000000001", name: "Example" },
  institutionVerificationState: "verified",
  latestVerificationRequest: null,
};

describe("toAccountViewModel", () => {
  test("derives capabilities from the canonical trust policy", () => {
    expect(toAccountViewModel(base).capabilities).toEqual({
      browseMetadata: true,
      transact: true,
      submitClaim: true,
      download: true,
    });
  });

  test("restriction overrides institution verification", () => {
    expect(toAccountViewModel({ ...base, hasActiveRestriction: true }).capabilities.transact).toBe(
      false,
    );
  });
});
