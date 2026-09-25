import { beforeEach, expect, test, vi } from "vitest";
import { NotificationEmailDeliveryService } from "./email-delivery-service";
import type { NotificationEmailProvider } from "../adapters/brevo-email-provider";

const job = {
  notificationId: "10000000-0000-4000-8000-000000000001",
  leaseToken: "20000000-0000-4000-8000-000000000001",
  recipient: "hunter@example.test",
  kind: "claim_approved" as const,
  attempt: 1,
  idempotencyExpiresAt: "2026-09-24T00:00:00.000Z",
  correlationId: "30000000-0000-4000-8000-000000000001",
  context: {},
};

function dependencies(now = new Date("2026-09-23T00:00:00.000Z")) {
  const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
  return {
    appUrl: "https://bilikkebal.afes.my",
    now: () => now,
    repository: {
      claimBatch: vi.fn().mockResolvedValue([job]),
      markSent: vi.fn().mockResolvedValue(undefined),
      recordFailure: vi.fn().mockResolvedValue(undefined),
      moveToManualReview: vi.fn().mockResolvedValue(undefined),
    },
    provider: {
      send: vi.fn<NotificationEmailProvider["send"]>().mockResolvedValue({
        providerMessageId: "email_test_123",
      }),
    },
    log,
  };
}

beforeEach(() => vi.restoreAllMocks());

test("sends branded server-composed copy and acknowledges with the matching lease", async () => {
  const deps = dependencies();
  const service = new NotificationEmailDeliveryService(deps);

  await expect(service.dispatchBatch()).resolves.toEqual({
    claimed: 1,
    sent: 1,
    retried: 0,
    manualReview: 0,
    failed: 0,
  });
  expect(deps.provider.send).toHaveBeenCalledWith({
    notificationId: job.notificationId,
    recipient: job.recipient,
    subject: "Your claim was approved",
    text: expect.stringContaining(
      "A Sheriff approved your claim. Check your claims for the next step.",
    ),
    html: expect.stringMatching(/^<!DOCTYPE html>/),
  });
  expect(deps.repository.markSent).toHaveBeenCalledWith(
    job.notificationId,
    job.leaseToken,
    "email_test_123",
  );
  expect(deps.log).toHaveBeenCalledWith(
    expect.stringContaining('"operation":"notifications.email_dispatch"'),
  );
  expect(JSON.stringify(deps.log.mock.calls)).not.toContain(job.recipient);
});

test("records a retryable failure without exposing provider error details", async () => {
  const deps = dependencies();
  deps.provider.send.mockRejectedValue(new Error("provider response leaked hunter@example.test"));
  const service = new NotificationEmailDeliveryService(deps);

  await expect(service.dispatchBatch()).resolves.toMatchObject({
    claimed: 1,
    sent: 0,
    retried: 1,
  });
  expect(deps.repository.recordFailure).toHaveBeenCalledWith(
    job.notificationId,
    job.leaseToken,
    "provider_unavailable",
    true,
  );
  expect(JSON.stringify(deps.log.mock.calls)).not.toContain("hunter@example.test");
});

test("fails a job with no registered email without calling the provider", async () => {
  const deps = dependencies();
  deps.repository.claimBatch.mockResolvedValue([{ ...job, recipient: null }]);
  const service = new NotificationEmailDeliveryService(deps);

  await expect(service.dispatchBatch()).resolves.toMatchObject({ claimed: 1, failed: 1 });
  expect(deps.provider.send).not.toHaveBeenCalled();
  expect(deps.repository.recordFailure).toHaveBeenCalledWith(
    job.notificationId,
    job.leaseToken,
    "invalid_recipient",
    false,
  );
});

test("moves an uncertain delivery outside the provider idempotency window to operator review", async () => {
  const deps = dependencies(new Date("2026-09-25T00:00:00.000Z"));
  const service = new NotificationEmailDeliveryService(deps);

  await expect(service.dispatchBatch()).resolves.toMatchObject({
    claimed: 1,
    manualReview: 1,
    sent: 0,
  });
  expect(deps.provider.send).not.toHaveBeenCalled();
  expect(deps.repository.moveToManualReview).toHaveBeenCalledWith(
    job.notificationId,
    job.leaseToken,
    "idempotency_window_elapsed",
  );
});

test("renders allow-listed context into the Sheriff alert", async () => {
  const deps = dependencies();
  deps.repository.claimBatch.mockResolvedValue([
    {
      ...job,
      kind: "institution_verification_submitted",
      context: { requesterDisplayName: "Aina", institutionName: "UiTM" },
    },
  ]);
  const service = new NotificationEmailDeliveryService(deps);

  await service.dispatchBatch();

  const sent = deps.provider.send.mock.calls[0]?.[0];
  expect(sent?.subject).toBe("New institution verification request");
  expect(sent?.html).toContain("Aina");
  expect(sent?.text).toContain("UiTM");
});
