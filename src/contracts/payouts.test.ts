import { describe, expect, it } from "vitest";
import {
  expireBountyInputSchema,
  recordPayoutCompletionSchema,
  recordRefundCompletionSchema,
} from "./payouts";

describe("Payouts and Refunds Contract", () => {
  describe("recordPayoutCompletionSchema", () => {
    it("accepts valid payout completion payload", () => {
      const valid = {
        externalReference: "DUITNOW-20260925-0012",
        payoutMethod: "duitnow",
        evidenceNotes: "Transferred to Maybank 1234567890",
      };
      const result = recordPayoutCompletionSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("rejects unknown payout method", () => {
      const invalid = {
        externalReference: "REF-001",
        payoutMethod: "bitcoin",
      };
      const result = recordPayoutCompletionSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("rejects too short reference", () => {
      const invalid = {
        externalReference: "ab",
        payoutMethod: "bank_transfer",
      };
      const result = recordPayoutCompletionSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("recordRefundCompletionSchema", () => {
    it("accepts valid refund completion payload", () => {
      const valid = {
        externalReference: "REV-TOYYIBPAY-9876",
        refundMethod: "toyyibpay_reversal",
        evidenceNotes: "Automatic reversal via gateway",
      };
      const result = recordRefundCompletionSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("rejects invalid refund method", () => {
      const invalid = {
        externalReference: "REV-9876",
        refundMethod: "cash",
      };
      const result = recordRefundCompletionSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("expireBountyInputSchema", () => {
    it("accepts valid UUID for bounty expiry", () => {
      expect(
        expireBountyInputSchema.safeParse({
          wantedRequestId: "74000000-0000-4000-8000-000000000001",
        }).success,
      ).toBe(true);
    });

    it("rejects invalid UUID", () => {
      expect(
        expireBountyInputSchema.safeParse({
          wantedRequestId: "12345",
        }).success,
      ).toBe(false);
    });
  });
});
