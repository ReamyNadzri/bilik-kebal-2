import {
  NotificationService,
  type NotificationRepository,
  type NotificationRow,
} from "./notification-service";

const id = "10000000-0000-4000-8000-000000000001";
const row: NotificationRow = {
  id,
  kind: "claim_approved",
  subject_id: id,
  created_at: "2026-09-23T00:00:00.123456+00:00",
  read_at: null,
};
const repository = () => ({
  list: vi.fn<NotificationRepository["list"]>().mockResolvedValue([row]),
  markRead: vi.fn<NotificationRepository["markRead"]>().mockResolvedValue(true),
});

test("preserves database timestamp precision through cursor pagination", async () => {
  const repo = repository();
  repo.list.mockResolvedValue([row, { ...row, id: "10000000-0000-4000-8000-000000000002" }]);
  const service = new NotificationService(repo);
  const first = await service.list({ limit: "1" });
  expect(first.ok).toBe(true);
  if (!first.ok) throw new Error("Expected inbox");
  expect(first.data.items).toHaveLength(1);
  expect(first.data.items[0]?.message).toContain("Sheriff approved");
  await service.list({ cursor: first.data.nextCursor });
  expect(repo.list).toHaveBeenLastCalledWith({
    limit: 20,
    cursor: { createdAt: row.created_at, id },
  });
});

test.each([{ limit: 0 }, { limit: 51 }, { limit: 1.5 }, { recipient: id }, { cursor: "garbage" }])(
  "rejects invalid query %j before database access",
  async (input) => {
    const repo = repository();
    expect(await new NotificationService(repo).list(input)).toMatchObject({
      ok: false,
      code: "VALIDATION_ERROR",
    });
    expect(repo.list).not.toHaveBeenCalled();
  },
);

test("last page has no cursor and exposes no repository-only fields", async () => {
  const repo = repository();
  repo.list.mockResolvedValue([{ ...row, private_note: "secret" } as NotificationRow]);
  const result = await new NotificationService(repo).list({});
  expect(result).toMatchObject({ ok: true, data: { nextCursor: null } });
  expect(JSON.stringify(result)).not.toContain("secret");
});

test("sanitizes failed reads and malformed persisted data", async () => {
  const repo = repository();
  repo.list.mockRejectedValueOnce(new Error("secret token"));
  const service = new NotificationService(repo);
  expect(await service.list({})).toEqual({
    ok: false,
    code: "NOTIFICATIONS_UNAVAILABLE",
    message: "Notifications are temporarily unavailable.",
  });
  repo.list.mockResolvedValueOnce([{ ...row, kind: "unknown" } as unknown as NotificationRow]);
  expect(await service.list({})).toMatchObject({ ok: false, code: "NOTIFICATIONS_UNAVAILABLE" });
});

test("mark-read rejects injected ownership and hides missing versus inaccessible records", async () => {
  const repo = repository();
  const service = new NotificationService(repo);
  expect(await service.markRead({ id, recipient: id })).toMatchObject({ code: "VALIDATION_ERROR" });
  expect(repo.markRead).not.toHaveBeenCalled();
  repo.markRead.mockResolvedValue(false);
  expect(await service.markRead({ id })).toMatchObject({ code: "REQUEST_NOT_FOUND" });
  repo.markRead.mockResolvedValue(true);
  expect(await service.markRead({ id })).toEqual({ ok: true, data: { read: true } });
});
