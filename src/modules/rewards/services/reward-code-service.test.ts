import { describe, expect, it, vi } from "vitest";
import { RewardCodeService, type RewardCodeRepository } from "./reward-code-service";

const actor = { userId: "00000000-0000-4000-8000-000000000002", emailVerified: true };

function repository(overrides: Partial<RewardCodeRepository> = {}): RewardCodeRepository {
  return {
    redeem: vi.fn().mockResolvedValue("redeemed"),
    remainingFreeRequests: vi.fn().mockResolvedValue(5),
    ...overrides,
  };
}

describe("RewardCodeService", () => {
  it("redeems a trimmed code and reports the new free-request total", async () => {
    const repo = repository();

    const result = await new RewardCodeService(repo).redeem(actor, { code: "  RAYA2026 " });

    expect(result).toEqual({ ok: true, data: { outcome: "redeemed", remaining: 5 } });
    expect(repo.redeem).toHaveBeenCalledWith("RAYA2026");
  });

  it.each(["invalid", "already_redeemed", "exhausted", "rate_limited"] as const)(
    "passes the %s refusal through as an answer",
    async (outcome) => {
      const repo = repository({ redeem: vi.fn().mockResolvedValue(outcome) });

      const result = await new RewardCodeService(repo).redeem(actor, { code: "RAYA2026" });

      expect(result).toMatchObject({ ok: true, data: { outcome } });
    },
  );

  it("rejects malformed codes before asking the database", async () => {
    const repo = repository();

    const result = await new RewardCodeService(repo).redeem(actor, { code: "no spaces!" });

    expect(result).toMatchObject({ ok: false, code: "VALIDATION_ERROR" });
    expect(repo.redeem).not.toHaveBeenCalled();
  });

  it("requires a signed-in, email-verified member", async () => {
    const service = new RewardCodeService(repository());

    await expect(service.redeem(null, { code: "RAYA2026" })).resolves.toMatchObject({
      code: "AUTH_REQUIRED",
    });
    await expect(
      service.redeem({ ...actor, emailVerified: false }, { code: "RAYA2026" }),
    ).resolves.toMatchObject({ code: "EMAIL_NOT_VERIFIED" });
  });
});
