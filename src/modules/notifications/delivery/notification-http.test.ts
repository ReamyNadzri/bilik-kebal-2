import { notificationHttp } from "./notification-http";
import { createNotificationService } from "../services/create-notification-service";
import { NotificationService } from "../services/notification-service";

vi.mock("../services/create-notification-service", () => ({ createNotificationService: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

test("anonymous access is refused with no-store and a correlation ID", async () => {
  vi.mocked(createNotificationService).mockResolvedValue(null);
  const response = await notificationHttp(
    new Request("https://vaultix.test/api/notifications"),
    "list",
  );
  expect(response.status).toBe(401);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("x-correlation-id")).toMatch(/^[0-9a-f-]{36}$/);
});

test("authenticated list returns only the service result", async () => {
  vi.mocked(createNotificationService).mockResolvedValue(
    new NotificationService({ list: async () => [], markRead: async () => false }),
  );
  const response = await notificationHttp(
    new Request("https://vaultix.test/api/notifications?limit=10"),
    "list",
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true, data: { items: [], nextCursor: null } });
});

test("malformed mark-read body is a safe 400", async () => {
  vi.mocked(createNotificationService).mockResolvedValue(
    new NotificationService({ list: async () => [], markRead: async () => false }),
  );
  const response = await notificationHttp(
    new Request("https://vaultix.test/api/notifications", { method: "PATCH", body: "bad json" }),
    "read",
  );
  expect(response.status).toBe(400);
});

test("auth/provider failures become 503 without leaking provider details to response or logs", async () => {
  vi.mocked(createNotificationService).mockRejectedValue(new Error("private-provider-secret"));
  const response = await notificationHttp(
    new Request("https://vaultix.test/api/notifications"),
    "list",
  );
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("private-provider-secret");
  expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toContain(
    "private-provider-secret",
  );
});
