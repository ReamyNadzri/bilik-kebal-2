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

  test("passes the accepted Terms version through, and leaves it out when unknown", () => {
    expect(toAccountViewModel({ ...base, termsAcceptedVersion: "2026-10-03" })).toMatchObject({
      termsAcceptedVersion: "2026-10-03",
    });
    expect(
      toAccountViewModel({ ...base, termsAcceptedVersion: null }).termsAcceptedVersion,
    ).toBeNull();
    expect(toAccountViewModel(base)).not.toHaveProperty("termsAcceptedVersion");
  });
});
