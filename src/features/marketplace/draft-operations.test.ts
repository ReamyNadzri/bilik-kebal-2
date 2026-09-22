import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createDraftContributionBill } from "./draft-operations";
import type { BillView } from "@/contracts/money";

describe("draft-operations", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("createDraftContributionBill", () => {
    it("calls POST /api/marketplace/wanted/drafts/:id/contribution with token and integer sen amount", async () => {
      const mockBill: BillView = {
        id: "intent-123",
        provider: "toyyibpay",
        amountSen: 2500 as never,
        status: "pending",
        paymentUrl: "https://dev.toyyibpay.com/bill-abc",
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, data: mockBill }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await createDraftContributionBill(
        "draft-456",
        "valid-duplicate-token-32-chars-long",
        2500,
      );

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/marketplace/wanted/drafts/draft-456/contribution",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            duplicateCheckToken: "valid-duplicate-token-32-chars-long",
            amountSen: 2500,
          }),
        },
      );

      expect(result).toEqual({ ok: true, data: mockBill });
    });

    it("handles launch-gate refusal PAYMENT_DISABLED", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: false,
            code: "PAYMENT_DISABLED",
            message: "Payments are currently disabled.",
          }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

      const result = await createDraftContributionBill("draft-456", "token", 2500);

      expect(result).toEqual({
        ok: false,
        code: "PAYMENT_DISABLED",
        message: "Payments are currently disabled.",
      });
    });

    it("handles amount out of range refusal AMOUNT_OUT_OF_RANGE", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: false,
            code: "AMOUNT_OUT_OF_RANGE",
            message: "Contribution must be between RM1 and RM50.",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

      const result = await createDraftContributionBill("draft-456", "token", 99999);

      expect(result).toEqual({
        ok: false,
        code: "AMOUNT_OUT_OF_RANGE",
        message: "Contribution must be between RM1 and RM50.",
      });
    });

    it("returns MONEY_UNAVAILABLE on server or network crash", async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error("Network disconnect"));

      const result = await createDraftContributionBill("draft-456", "token", 2500);

      expect(result).toEqual({
        ok: false,
        code: "MONEY_UNAVAILABLE",
        message: "Could not reach the server. Check your connection and try again.",
      });
    });
  });
});
