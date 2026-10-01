import { describe, expect, it, vi } from "vitest";
import { normaliseMalaysianMobile } from "@/contracts/payment-details";
import { PaymentDetailsService } from "./payment-details-service";

const saved = {
  accountHolderName: "Aminah Binti Ali",
  accountNumberLast4: "6789",
  bankCode: "maybank" as const,
  bankName: "Maybank",
  phone: "+60123456789",
  updatedAt: "2026-09-30T10:00:00.000Z",
};

function repository() {
  return {
    readOwn: vi.fn().mockResolvedValue(saved),
    saveOwn: vi.fn().mockResolvedValue(undefined),
  };
}

describe("normaliseMalaysianMobile", () => {
  it.each([
    ["012-345 6789", "+60123456789"],
    ["0123456789", "+60123456789"],
    ["60123456789", "+60123456789"],
    ["+60 11 2345 6789", "+601123456789"],
  ])("reads %s as %s", (input, expected) => {
    expect(normaliseMalaysianMobile(input)).toBe(expected);
  });

  it.each(["0312345678", "12345", "+65 9123 4567", ""])("refuses %s", (input) => {
    expect(normaliseMalaysianMobile(input)).toBeNull();
  });
});

describe("PaymentDetailsService", () => {
  it("saves normalised details and returns them masked", async () => {
    const repo = repository();
    const result = await new PaymentDetailsService(repo).save(
      { userId: "u" },
      {
        accountHolderName: " Aminah Binti Ali ",
        accountNumber: "7000 5678 9",
        bankCode: "maybank",
        phone: "012-345 6789",
      },
    );
    expect(repo.saveOwn).toHaveBeenCalledWith({
      accountHolderName: "Aminah Binti Ali",
      accountNumber: "700056789",
      bankCode: "maybank",
      phone: "+60123456789",
    });
    expect(result).toEqual({ ok: true, data: saved });
    expect(JSON.stringify(result)).not.toContain("700056789");
  });

  it("names each field that is wrong and saves nothing", async () => {
    const repo = repository();
    const result = await new PaymentDetailsService(repo).save(
      { userId: "u" },
      { accountHolderName: "A", accountNumber: "12ab", bankCode: "nope", phone: "999" },
    );
    expect(result).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    expect(result.ok ? [] : Object.keys(result.fieldErrors ?? {}).sort()).toEqual([
      "accountHolderName",
      "accountNumber",
      "bankCode",
      "phone",
    ]);
    expect(repo.saveOwn).not.toHaveBeenCalled();
  });

  it("requires a signed-in member", async () => {
    expect(await new PaymentDetailsService(repository()).save(null, {})).toMatchObject({
      ok: false,
      code: "AUTH_REQUIRED",
    });
  });
});
