import { describe, expect, test, vi } from "vitest";

import { VerificationService, type VerificationRepository } from "./verification-service";

const now = new Date("2026-09-14T02:00:00.000Z");
const userId = "00000000-0000-4000-8000-000000000001";
const reviewerId = "00000000-0000-4000-8000-000000000002";
const institutionId = "10000000-0000-4000-8000-000000000001";

function createRepository(): VerificationRepository {
  return {
    createManualRequest: vi.fn().mockResolvedValue({ requestId: "request-1" }),
    restrictAccount: vi.fn().mockResolvedValue({ status: "created" }),
    reviewManualRequest: vi.fn().mockResolvedValue({ status: "updated" }),
    verifyMembershipByEmailDomain: vi.fn().mockResolvedValue({ status: "not_approved" }),
  };
}

describe("VerificationService", () => {
  test("automatically verifies only an email-verified user on an approved domain", async () => {
    const repository = createRepository();
    vi.mocked(repository.verifyMembershipByEmailDomain).mockResolvedValue({
      institutionId,
      status: "verified",
    });
    const service = new VerificationService(repository, () => now);

    const result = await service.verifyByEmailDomain({
      email: " Student@UiTM.Example ",
      emailVerified: true,
      userId,
    });

    expect(repository.verifyMembershipByEmailDomain).toHaveBeenCalledWith("uitm.example");
    expect(result).toEqual({
      ok: true,
      data: { institutionId, status: "verified" },
    });
  });

  test("keeps email verification separate from institution verification", async () => {
    const repository = createRepository();
    const service = new VerificationService(repository, () => now);

    const result = await service.verifyByEmailDomain({
      email: "student@uitm.example",
      emailVerified: false,
      userId,
    });

    expect(result).toMatchObject({ ok: false, code: "EMAIL_NOT_VERIFIED" });
    expect(repository.verifyMembershipByEmailDomain).not.toHaveBeenCalled();
  });

  test("routes an unapproved domain to manual verification", async () => {
    const repository = createRepository();
    const service = new VerificationService(repository, () => now);

    const result = await service.verifyByEmailDomain({
      email: "student@example.com",
      emailVerified: true,
      userId,
    });

    expect(result).toEqual({
      ok: false,
      code: "DOMAIN_NOT_APPROVED",
      message: "This email domain is not approved for automatic verification. Use manual review.",
    });
  });

  test("creates a manual request with a 30-day evidence retention timestamp", async () => {
    const repository = createRepository();
    const service = new VerificationService(repository, () => now);

    const result = await service.requestManualVerification({
      emailVerified: true,
      evidenceObjectPath: `${userId}/student-card.pdf`,
      institutionId,
      userId,
    });

    expect(repository.createManualRequest).toHaveBeenCalledWith({
      evidenceDeleteAfter: "2026-10-14T02:00:00.000Z",
      evidenceObjectPath: `${userId}/student-card.pdf`,
      institutionId,
      userId,
    });
    expect(result).toEqual({
      ok: true,
      data: {
        evidenceDeleteAfter: "2026-10-14T02:00:00.000Z",
        requestId: "request-1",
        status: "pending",
      },
    });
  });

  test("limits an Institution Sheriff review to an assigned institution", async () => {
    const repository = createRepository();
    const service = new VerificationService(repository, () => now);

    const result = await service.reviewManualVerification(
      {
        decision: "approved",
        institutionId,
        reasonCode: "evidence_confirmed",
        requestId: "request-1",
      },
      {
        authenticatedAt: "2026-09-14T01:55:00.000Z",
        institutionSheriffFor: [],
        platformRole: null,
        userId: reviewerId,
      },
    );

    expect(result).toMatchObject({ ok: false, code: "NOT_AUTHORIZED" });
    expect(repository.reviewManualRequest).not.toHaveBeenCalled();
  });

  test("requires recent authentication for an authorised reviewer", async () => {
    const repository = createRepository();
    const service = new VerificationService(repository, () => now);

    const result = await service.reviewManualVerification(
      {
        decision: "rejected",
        institutionId,
        reasonCode: "evidence_unclear",
        requestId: "request-1",
      },
      {
        authenticatedAt: "2026-09-14T01:00:00.000Z",
        institutionSheriffFor: [institutionId],
        platformRole: null,
        userId: reviewerId,
      },
    );

    expect(result).toMatchObject({ ok: false, code: "RECENT_AUTH_REQUIRED" });
    expect(repository.reviewManualRequest).not.toHaveBeenCalled();
  });

  test("allows a recently authenticated Platform Sheriff to restrict an account", async () => {
    const repository = createRepository();
    const service = new VerificationService(repository, () => now);

    const result = await service.restrictAccount(
      { reasonCode: "high_risk_report", userId },
      {
        authenticatedAt: "2026-09-14T01:55:00.000Z",
        institutionSheriffFor: [],
        platformRole: "platform_sheriff",
        userId: reviewerId,
      },
    );

    expect(repository.restrictAccount).toHaveBeenCalledWith({
      actorUserId: reviewerId,
      reasonCode: "high_risk_report",
      userId,
    });
    expect(result).toEqual({ ok: true, data: { status: "restricted" } });
  });
});
