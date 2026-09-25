import { expect, test, vi } from "vitest";
import { notificationEmailDispatchHttp } from "./email-dispatch-http";

const SECRET = "a-dispatch-secret-of-at-least-32-characters";
const counts = { claimed: 2, sent: 1, retried: 1, manualReview: 0, failed: 0 };

test("rejects unauthenticated dispatch without claiming outbox jobs", async () => {
  const dispatch = vi.fn().mockResolvedValue(counts);
  const response = await notificationEmailDispatchHttp(
    new Request("https://vaultix.example/api/internal/notifications/email", { method: "POST" }),
    { dispatchSecret: SECRET, dispatch },
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
      headers: { authorization: `Bearer ${SECRET}` },
    }),
    { dispatchSecret: SECRET, dispatch },
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
      headers: { authorization: `Bearer ${SECRET}` },
    }),
    { dispatchSecret: SECRET, dispatch },
  );

  expect(response.status).toBe(503);
  await expect(response.text()).resolves.not.toContain("private provider error");
});

test("refuses to run when the dispatch secret is missing or too short", async () => {
  const dispatch = vi.fn().mockResolvedValue(counts);
  for (const dispatchSecret of [undefined, "short"]) {
    const response = await notificationEmailDispatchHttp(
      new Request("https://vaultix.example/api/internal/notifications/email", {
        method: "POST",
        headers: { authorization: "Bearer short" },
      }),
      { dispatchSecret, dispatch },
    );
    expect(response.status).toBe(503);
  }
  expect(dispatch).not.toHaveBeenCalled();
});
