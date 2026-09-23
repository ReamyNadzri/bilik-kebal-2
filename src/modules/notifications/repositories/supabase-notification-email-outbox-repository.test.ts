import { expect, test, vi } from "vitest";
import { SupabaseNotificationEmailOutboxRepository } from "./supabase-notification-email-outbox-repository";

const job = {
  notification_id: "10000000-0000-4000-8000-000000000001",
  lease_token: "20000000-0000-4000-8000-000000000001",
  recipient_email: "hunter@example.test",
  notification_kind: "claim_approved",
  attempt: 2,
  idempotency_expires_at: "2026-09-24T00:00:00.000Z",
  correlation_id: "30000000-0000-4000-8000-000000000001",
};

test("claims and validates private email jobs through the service-only RPC", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify([job]), { status: 200 }));
  const repository = new SupabaseNotificationEmailOutboxRepository({
    baseUrl: "https://project.supabase.co",
    serviceRoleKey: "service-secret",
    fetcher,
  });

  await expect(repository.claimBatch(5)).resolves.toEqual([
    {
      notificationId: job.notification_id,
      leaseToken: job.lease_token,
      recipient: job.recipient_email,
      kind: "claim_approved",
      attempt: 2,
      idempotencyExpiresAt: job.idempotency_expires_at,
      correlationId: job.correlation_id,
    },
  ]);
  expect(fetcher).toHaveBeenCalledWith(
    "https://project.supabase.co/rest/v1/rpc/claim_notification_email_batch",
    expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({
        apikey: "service-secret",
        authorization: "Bearer service-secret",
      }),
      body: JSON.stringify({ batch_size: 5 }),
    }),
  );
});

test("does not surface privileged PostgREST response details", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ message: "secret service-role details" }), { status: 500 }),
    );
  const repository = new SupabaseNotificationEmailOutboxRepository({
    baseUrl: "https://project.supabase.co",
    serviceRoleKey: "service-secret",
    fetcher,
  });

  await expect(repository.claimBatch()).rejects.toThrow("Notification outbox unavailable");
  await expect(repository.claimBatch()).rejects.not.toThrow("secret service-role details");
});
