import { describe, expect, it } from "vitest";
import { contributionIntentInputSchema } from "./money";

describe("money contracts", () => {
  it.each([100, 5000])("accepts contribution boundary %i sen", (amountSen) => {
    expect(
      contributionIntentInputSchema.parse({
        amountSen,
        draftId: "00000000-0000-4000-8000-000000000001",
        duplicateCheckToken: "x".repeat(32),
      }).amountSen,
    ).toBe(amountSen);
  });

  it.each([99, 5001, 100.5])("rejects invalid contribution %s", (amountSen) => {
    expect(() =>
      contributionIntentInputSchema.parse({
        amountSen,
        draftId: "00000000-0000-4000-8000-000000000001",
        duplicateCheckToken: "x".repeat(32),
      }),
    ).toThrow();
  });

  it("rejects provider payloads at the public input boundary", () => {
    expect(() =>
      contributionIntentInputSchema.parse({
        amountSen: 100,
        draftId: "00000000-0000-4000-8000-000000000001",
        duplicateCheckToken: "x".repeat(32),
        signature: "secret",
      }),
    ).not.toThrow();
  });
});
