import { describe, expect, it } from "vitest";
import { claimEligibility } from "./claim-policy";

const actor = {
  emailVerified: true,
  institutionVerified: true,
  restricted: false,
};

describe("claim eligibility", () => {
  it("allows only institution-verified, unrestricted claimants on an open Wanted", () => {
    expect(claimEligibility(actor, "open")).toBeNull();
  });

  it("separates trust failures from Wanted lifecycle refusal", () => {
    expect(claimEligibility({ ...actor, emailVerified: false }, "open")).toBe("EMAIL_NOT_VERIFIED");
    expect(claimEligibility({ ...actor, institutionVerified: false }, "open")).toBe(
      "INSTITUTION_VERIFICATION_REQUIRED",
    );
    expect(claimEligibility({ ...actor, restricted: true }, "open")).toBe("ACCOUNT_RESTRICTED");
    expect(claimEligibility(actor, "reviewing")).toBe("WANTED_NOT_OPEN");
  });
});
