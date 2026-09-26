const factories = vi.hoisted(() => ({
  createClaimReviewService: vi.fn(),
  createClaimModerationService: vi.fn(),
  createPayoutService: vi.fn(),
}));

vi.mock("@/modules/claims/services/create-claim-review-service", () => ({
  createClaimReviewService: factories.createClaimReviewService,
}));
vi.mock("@/modules/moderation/services/create-claim-moderation-service", () => ({
  createClaimModerationService: factories.createClaimModerationService,
}));
vi.mock("@/modules/payouts/services/create-payout-service", () => ({
  createPayoutService: factories.createPayoutService,
}));

import { loadConsoleQueueCounts } from "./console-queue-counts";

const reviewer = "00000000-0000-4000-8000-000000000001";
const listQueue = vi.fn();
const listAppeals = vi.fn();
const listPayoutTasks = vi.fn();
const listRefundTasks = vi.fn();

beforeEach(() => {
  listQueue.mockReset().mockResolvedValue({ ok: true, data: [{}, {}] });
  listAppeals.mockReset().mockResolvedValue([{}]);
  listPayoutTasks.mockReset().mockResolvedValue({ ok: true, data: [{}, {}, {}] });
  listRefundTasks.mockReset().mockResolvedValue({ ok: true, data: [] });
  factories.createClaimReviewService.mockReset().mockResolvedValue({ listQueue });
  factories.createClaimModerationService.mockReset().mockResolvedValue({ listAppeals });
  factories.createPayoutService.mockReset().mockResolvedValue({
    service: { listPayoutTasks, listRefundTasks },
    userId: reviewer,
  });
});

test("counts each queue through the operation that queue uses", async () => {
  expect(await loadConsoleQueueCounts()).toEqual({
    claims: 2,
    appeals: 1,
    payouts: 3,
    refunds: 0,
  });
  expect(listAppeals).toHaveBeenCalledWith({ status: "pending" });
  expect(listPayoutTasks).toHaveBeenCalledWith(reviewer, "pending");
  expect(listRefundTasks).toHaveBeenCalledWith(reviewer, "pending");
});

test("reports every count as unavailable without a session", async () => {
  factories.createClaimReviewService.mockResolvedValue(null);
  factories.createClaimModerationService.mockResolvedValue(null);
  factories.createPayoutService.mockResolvedValue(null);

  expect(await loadConsoleQueueCounts()).toEqual({
    claims: null,
    appeals: null,
    payouts: null,
    refunds: null,
  });
});

test("reports a refused queue as unavailable rather than empty", async () => {
  listPayoutTasks.mockResolvedValue({ ok: false, code: "FORBIDDEN", message: "Staff only." });
  listRefundTasks.mockResolvedValue({ ok: false, code: "FORBIDDEN", message: "Staff only." });

  const counts = await loadConsoleQueueCounts();

  expect(counts.payouts).toBeNull();
  expect(counts.refunds).toBeNull();
  expect(counts.claims).toBe(2);
});

test("keeps the other counts when one queue cannot be read", async () => {
  listAppeals.mockRejectedValue(new Error("appeals unavailable"));

  expect(await loadConsoleQueueCounts()).toEqual({
    claims: 2,
    appeals: null,
    payouts: 3,
    refunds: 0,
  });
});
