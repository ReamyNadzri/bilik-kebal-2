import { describe, expect, it, vi } from "vitest";
import type { PayoutTaskView, RefundTaskView } from "@/contracts/payouts";
import type { PayoutRepository } from "../repositories/payout-repository";
import { PayoutService } from "./payout-service";

describe("PayoutService", () => {
  const mockPayoutTask: PayoutTaskView = {
    id: "payout-1",
    wantedRequestId: "wanted-1",
    claimId: "claim-1",
    hunterUserId: "hunter-1",
    hunterDisplayName: "Ahmad Hunter",
    grossBountySen: 5000,
    feeRateBasisPoints: 1000,
    platformFeeSen: 500,
    netPayoutSen: 4500,
    status: "pending",
    externalReference: null,
    payoutMethod: null,
    evidenceNotes: null,
    completedAt: null,
    ownerUserId: null,
    createdAt: "2026-09-24T00:00:00Z",
  };

  const mockRefundTask: RefundTaskView = {
    id: "refund-1",
    wantedRequestId: "wanted-1",
    contributionId: "contrib-1",
    contributorUserId: "user-1",
    contributorDisplayName: "Siti Contributor",
    amountSen: 2000,
    status: "pending",
    externalReference: null,
    refundMethod: null,
    evidenceNotes: null,
    completedAt: null,
    ownerUserId: null,
    createdAt: "2026-09-24T00:00:00Z",
  };

  const createMockRepo = (overrides?: Partial<PayoutRepository>): PayoutRepository => ({
    listPayoutTasks: vi.fn().mockResolvedValue([mockPayoutTask]),
    completePayout: vi.fn().mockResolvedValue(undefined),
    listRefundTasks: vi.fn().mockResolvedValue([mockRefundTask]),
    completeRefund: vi.fn().mockResolvedValue(undefined),
    expireBounty: vi.fn().mockResolvedValue(2),
    isOwner: vi.fn().mockResolvedValue(true),
    isStaff: vi.fn().mockResolvedValue(true),
    ...overrides,
  });

  describe("listPayoutTasks", () => {
    it("returns payout tasks for staff user", async () => {
      const repo = createMockRepo();
      const service = new PayoutService(repo);

      const result = await service.listPayoutTasks("owner-1");
      expect(result).toMatchObject({
        ok: true,
        data: [mockPayoutTask],
      });
    });

    it("rejects non-staff user", async () => {
      const repo = createMockRepo({ isStaff: vi.fn().mockResolvedValue(false) });
      const service = new PayoutService(repo);

      const result = await service.listPayoutTasks("student-1");
      expect(result).toMatchObject({
        ok: false,
        code: "FORBIDDEN",
      });
    });
  });

  describe("completePayout", () => {
    it("allows Owner to record payout completion", async () => {
      const repo = createMockRepo();
      const service = new PayoutService(repo);

      const result = await service.completePayout("owner-1", "payout-1", {
        externalReference: "DUITNOW-001",
        payoutMethod: "duitnow",
        evidenceNotes: "Completed via Maybank",
      });

      expect(result).toMatchObject({
        ok: true,
        data: { payoutTaskId: "payout-1" },
      });
      expect(repo.completePayout).toHaveBeenCalledWith(
        "payout-1",
        "DUITNOW-001",
        "duitnow",
        "Completed via Maybank",
      );
    });

    it("forbids non-owner from recording payout", async () => {
      const repo = createMockRepo({ isOwner: vi.fn().mockResolvedValue(false) });
      const service = new PayoutService(repo);

      const result = await service.completePayout("sheriff-1", "payout-1", {
        externalReference: "DUITNOW-001",
        payoutMethod: "duitnow",
      });

      expect(result).toMatchObject({
        ok: false,
        code: "FORBIDDEN",
      });
    });
  });

  describe("completeRefund", () => {
    it("allows Owner to record refund completion", async () => {
      const repo = createMockRepo();
      const service = new PayoutService(repo);

      const result = await service.completeRefund("owner-1", "refund-1", {
        externalReference: "REV-001",
        refundMethod: "toyyibpay_reversal",
        evidenceNotes: "Reversed via portal",
      });

      expect(result).toMatchObject({
        ok: true,
        data: { refundTaskId: "refund-1" },
      });
      expect(repo.completeRefund).toHaveBeenCalledWith(
        "refund-1",
        "REV-001",
        "toyyibpay_reversal",
        "Reversed via portal",
      );
    });

    it("forbids non-owner from recording refund", async () => {
      const repo = createMockRepo({ isOwner: vi.fn().mockResolvedValue(false) });
      const service = new PayoutService(repo);

      const result = await service.completeRefund("sheriff-1", "refund-1", {
        externalReference: "REV-001",
        refundMethod: "toyyibpay_reversal",
      });

      expect(result).toMatchObject({
        ok: false,
        code: "FORBIDDEN",
      });
    });
  });

  describe("expireBounty", () => {
    it("allows staff to trigger bounty expiry", async () => {
      const repo = createMockRepo();
      const service = new PayoutService(repo);

      const result = await service.expireBounty("sheriff-1", "wanted-1");
      expect(result).toMatchObject({
        ok: true,
        data: { refundsCreated: 2 },
      });
      expect(repo.expireBounty).toHaveBeenCalledWith("wanted-1");
    });

    it("handles paused bounty error gracefully", async () => {
      const repo = createMockRepo({
        expireBounty: vi.fn().mockRejectedValue(new Error("bounty is paused by active appeal")),
      });
      const service = new PayoutService(repo);

      const result = await service.expireBounty("sheriff-1", "wanted-1");
      expect(result).toMatchObject({
        ok: false,
        code: "INVALID_STATE",
        message: "Bounty is paused by an active appeal.",
      });
    });
  });
});
