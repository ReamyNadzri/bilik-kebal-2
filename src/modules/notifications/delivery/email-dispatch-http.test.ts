import { expect, test, vi } from "vitest";
import { notificationEmailDispatchHttp } from "./email-dispatch-http";

const counts = { claimed: 2, sent: 1, retried: 1, manualReview: 0, failed: 0 };

test("rejects unauthenticated dispatch without claiming outbox jobs", async () => {
  const dispatch = vi.fn().mockResolvedValue(counts);
  const response = await notificationEmailDispatchHttp(
    new Request("https://vaultix.example/api/internal/notifications/email", { method: "POST" }),
    { serviceRoleKey: "a-long-service-role-secret", dispatch },
  );

  expect(response.status).toBe(401);
  expect(response.headers.get("X-Correlation-ID")).toMatch(/^[0-9a-f-]{36}$/);
  expect(dispatch).not.toHaveBeenCalled();
});

test("returns safe counts and no-store headers to an authorised dispatcher", async () => {
  const dispatch = vi.fn().mockResolvedValue(counts);
  const response = await notificationEmailDispatchHttp(
    new Request("https://vaultix.example/api/internal/notifications/email", {
      method: "POST",
      headers: { authorization: "Bearer a-long-service-role-secret" },
    }),
    { serviceRoleKey: "a-long-service-role-secret", dispatch },
  );

  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  await expect(response.json()).resolves.toEqual({ ok: true, data: counts });
  expect(dispatch).toHaveBeenCalledOnce();
});

test("does not disclose dispatcher failure details", async () => {
  const dispatch = vi.fn().mockRejectedValue(new Error("private provider error"));
  const response = await notificationEmailDispatchHttp(
    new Request("https://vaultix.example/api/internal/notifications/email", {
      method: "POST",
      headers: { authorization: "Bearer a-long-service-role-secret" },
    }),
    { serviceRoleKey: "a-long-service-role-secret", dispatch },
  );

  expect(response.status).toBe(503);
  await expect(response.text()).resolves.not.toContain("private provider error");
});
