import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { ProviderBill, VerifiedProviderCallback } from "@/contracts/money";
import type { WantedActor } from "@/modules/wanted/domain/wanted-policy";
import type { StoredWantedDraft } from "@/modules/wanted/repositories/wanted-repository";
import type { MoneyRepository } from "../repositories/money-repository";
import { ContributionService } from "./contribution-service";
import type { ToyyibPayAdapter } from "../providers/toyyibpay";

const actor: WantedActor = {
  userId: "00000000-0000-4000-8000-000000000001",
  emailVerified: true,
  institutionId: "00000000-0000-4000-8000-000000000002",
  institutionVerified: true,
  restricted: false,
};
const draft = {
  id: "00000000-0000-4000-8000-000000000003",
  state: "draft",
  values: { durationDays: 14 },
} as unknown as StoredWantedDraft;
const bill: ProviderBill = {
  providerBillId: "bill-1",
  paymentUrl: "https://pay.test/bill-1",
  expiresAt: "2026-09-15T00:30:00.000Z",
};
const token = `nonce.${createHmac("sha256", "money-test-secret-32-characters-long")
  .update("nonce")
  .digest("hex")}`;

function repository(overrides: Partial<MoneyRepository> = {}): MoneyRepository {
  return {
    findDraftForContribution: vi.fn().mockResolvedValue(draft),
    createContributionIntent: vi.fn().mockResolvedValue({ intentId: "intent-1" }),
    recordVerifiedContribution: vi.fn().mockResolvedValue("accepted"),
    ...overrides,
  };
}

function adapter(): ToyyibPayAdapter {
  return {
    createBill: vi.fn().mockResolvedValue(bill),
    verifyCallback: vi.fn(),
  } as unknown as ToyyibPayAdapter;
}

describe("ContributionService", () => {
  it("keeps the payment kill switch closed", async () => {
    const repo = repository();
    const service = new ContributionService(repo, adapter(), {
      paymentMode: "disabled",
      tokenSecret: "money-test-secret-32-characters-long",
    });
    expect(
      await service.createIntent(actor, {
        amountSen: 100,
        draftId: draft.id,
        duplicateCheckToken: token,
      }),
    ).toMatchObject({ ok: false, code: "PAYMENT_DISABLED" });
    expect(repo.createContributionIntent).not.toHaveBeenCalled();
  });

  it("creates a safe pending bill only for an editable owned draft", async () => {
    const repo = repository();
    const service = new ContributionService(repo, adapter(), {
      paymentMode: "sandbox",
      tokenSecret: "money-test-secret-32-characters-long",
    });
    const result = await service.createIntent(actor, {
      amountSen: 1250,
      draftId: draft.id,
      duplicateCheckToken: token,
    });
    expect(result).toMatchObject({
      ok: true,
      data: {
        id: "intent-1",
        amountSen: 1250,
        provider: "toyyibpay",
        status: "pending",
      },
    });
    expect(repo.createContributionIntent).toHaveBeenCalledWith(
      expect.objectContaining({ amountSen: 1250, draftId: draft.id }),
    );
  });

  it("refuses a forged duplicate token before creating a provider bill", async () => {
    const provider = adapter();
    const service = new ContributionService(repository(), provider, {
      paymentMode: "sandbox",
      tokenSecret: "money-test-secret-32-characters-long",
    });
    expect(
      await service.createIntent(actor, {
        amountSen: 100,
        draftId: draft.id,
        duplicateCheckToken: "forged-token-value-which-is-long-enough",
      }),
    ).toMatchObject({ ok: false, code: "DUPLICATE_CHECK_REQUIRED" });
    expect(provider.createBill).not.toHaveBeenCalled();
  });

  it("maps verified callback outcomes without trusting provider success in the browser", async () => {
    const callback = { verified: true } as VerifiedProviderCallback;
    const repo = repository({ recordVerifiedContribution: vi.fn().mockResolvedValue("duplicate") });
    const result = await new ContributionService(repo, adapter(), {
      paymentMode: "sandbox",
      tokenSecret: "money-test-secret-32-characters-long",
    }).handleVerifiedCallback(callback);
    expect(result).toEqual({ ok: true, data: { accepted: true, duplicate: true } });
  });

  it("asks the provider to retry when a verified event arrives before its bill intent", async () => {
    const callback = { verified: true } as VerifiedProviderCallback;
    const repo = repository({ recordVerifiedContribution: vi.fn().mockResolvedValue("unknown") });
    const result = await new ContributionService(repo, adapter(), {
      paymentMode: "sandbox",
      tokenSecret: "money-test-secret-32-characters-long",
    }).handleVerifiedCallback(callback);
    expect(result).toMatchObject({ ok: false, code: "MONEY_UNAVAILABLE" });
  });
});
