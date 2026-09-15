import { canManageWantedDraft, type WantedActor } from "./wanted-policy";

function actor(overrides: Partial<WantedActor> = {}): WantedActor {
  return {
    userId: "71000000-0000-0000-0000-000000000002",
    emailVerified: true,
    institutionId: "72000000-0000-0000-0000-000000000001",
    institutionVerified: true,
    restricted: false,
    ...overrides,
  };
}

describe("Wanted draft authority", () => {
  test("requires authentication", () => {
    expect(canManageWantedDraft(null)).toBe("AUTH_REQUIRED");
  });

  test("keeps email and institution verification separate", () => {
    expect(canManageWantedDraft(actor({ emailVerified: false }))).toBe("EMAIL_NOT_VERIFIED");
    expect(canManageWantedDraft(actor({ institutionVerified: false, institutionId: null }))).toBe(
      "INSTITUTION_VERIFICATION_REQUIRED",
    );
  });

  test("denies an actively restricted verified member", () => {
    expect(canManageWantedDraft(actor({ restricted: true }))).toBe("ACCOUNT_RESTRICTED");
  });

  test("permits an unrestricted institution-verified member", () => {
    expect(canManageWantedDraft(actor())).toBeNull();
  });
});
