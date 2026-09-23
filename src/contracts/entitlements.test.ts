import { describe, expect, it } from "vitest";
import { revokeEntitlementsInputSchema } from "./entitlements";

describe("Entitlements Contract", () => {
  it("validates valid revoke entitlements input", () => {
    const valid = {
      wantedRequestId: "74000000-0000-4000-8000-000000000001",
      reason: "Takedown requested by rights holder",
    };
    const result = revokeEntitlementsInputSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects short or empty reason", () => {
    const invalid = {
      wantedRequestId: "a0000000-0000-0000-0000-000000000001",
      reason: "bad",
    };
    const result = revokeEntitlementsInputSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects invalid UUID", () => {
    const invalid = {
      wantedRequestId: "not-a-uuid",
      reason: "Copyright infringement complaint",
    };
    const result = revokeEntitlementsInputSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
