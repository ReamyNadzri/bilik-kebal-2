import { describe, expect, it } from "vitest";
import { evaluateClaimDownloadAccess } from "./entitlement-policy";

describe("evaluateClaimDownloadAccess", () => {
  const baseClaim = {
    id: "c0000000-0000-0000-0000-000000000001",
    hunterUserId: "u-hunter",
    isRestricted: false,
    freeReleaseOptIn: false,
    rightsConfirmedAt: null,
    status: "approved",
    bucket: "approved",
  };

  it("blocks non-staff users when claim is restricted", () => {
    const result = evaluateClaimDownloadAccess({
      userId: "u-contributor",
      isStaff: false,
      claim: { ...baseClaim, isRestricted: true },
      entitlement: {
        id: "e-1",
        isRevoked: false,
        revocationReason: null,
      },
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("RESTRICTED");
  });

  it("permits staff to access even if claim is restricted for evidence inspection", () => {
    const result = evaluateClaimDownloadAccess({
      userId: "u-sheriff",
      isStaff: true,
      claim: { ...baseClaim, isRestricted: true },
      entitlement: null,
    });

    expect(result.allowed).toBe(true);
    expect(result.code).toBe("SUCCESS");
  });

  it("permits hunter to download their own submission", () => {
    const result = evaluateClaimDownloadAccess({
      userId: "u-hunter",
      isStaff: false,
      claim: baseClaim,
      entitlement: null,
    });

    expect(result.allowed).toBe(true);
    expect(result.code).toBe("SUCCESS");
  });

  it("permits contributor with valid unrevoked entitlement", () => {
    const result = evaluateClaimDownloadAccess({
      userId: "u-contributor",
      isStaff: false,
      claim: baseClaim,
      entitlement: {
        id: "e-1",
        isRevoked: false,
        revocationReason: null,
      },
    });

    expect(result.allowed).toBe(true);
    expect(result.code).toBe("SUCCESS");
  });

  it("blocks user with revoked entitlement", () => {
    const result = evaluateClaimDownloadAccess({
      userId: "u-contributor",
      isStaff: false,
      claim: baseClaim,
      entitlement: {
        id: "e-1",
        isRevoked: true,
        revocationReason: "Takedown notice",
      },
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("REVOKED");
    expect(result.reason).toBe("Takedown notice");
  });

  it("permits unentitled user when claim has free release opt-in AND confirmed rights", () => {
    const result = evaluateClaimDownloadAccess({
      userId: "u-student",
      isStaff: false,
      claim: {
        ...baseClaim,
        freeReleaseOptIn: true,
        rightsConfirmedAt: "2026-09-24T00:00:00Z",
      },
      entitlement: null,
    });

    expect(result.allowed).toBe(true);
    expect(result.code).toBe("SUCCESS");
  });

  it("rejects free release if rights were not confirmed", () => {
    const result = evaluateClaimDownloadAccess({
      userId: "u-student",
      isStaff: false,
      claim: {
        ...baseClaim,
        freeReleaseOptIn: true,
        rightsConfirmedAt: null,
      },
      entitlement: null,
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("NOT_ENTITLED");
  });

  it("rejects user with no entitlement and no free release", () => {
    const result = evaluateClaimDownloadAccess({
      userId: "u-random",
      isStaff: false,
      claim: baseClaim,
      entitlement: null,
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("NOT_ENTITLED");
  });
});
