import { describe, expect, test } from "vitest";
import { canBrowseMetadata, canDownload, canSubmitClaim, canTransact } from "./access-policy";
import type { IdentityTrust } from "./trust-state";

const emailVerified: IdentityTrust = {
  email: "verified",
  institution: "unverified",
  restricted: false,
};

const institutionVerified: IdentityTrust = {
  email: "verified",
  institution: "verified",
  restricted: false,
};

describe("identity trust access policy", () => {
  test("email verification permits metadata browsing but not transactions", () => {
    expect(canBrowseMetadata(emailVerified)).toBe(true);
    expect(canTransact(emailVerified)).toBe(false);
    expect(canSubmitClaim(emailVerified)).toBe(false);
    expect(canDownload(emailVerified)).toBe(false);
  });

  test("institution verification permits transactional actions", () => {
    expect(canBrowseMetadata(institutionVerified)).toBe(true);
    expect(canTransact(institutionVerified)).toBe(true);
    expect(canSubmitClaim(institutionVerified)).toBe(true);
    expect(canDownload(institutionVerified)).toBe(true);
  });

  test("restriction overrides otherwise valid trust", () => {
    expect(canTransact({ ...institutionVerified, restricted: true })).toBe(false);
  });
});
