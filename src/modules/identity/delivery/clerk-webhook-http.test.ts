import { afterEach, describe, expect, it, vi } from "vitest";

import { clerkWebhookHttp } from "./clerk-webhook-http";

const post = () =>
  new Request("https://bilikkebal.afes.my/api/webhooks/clerk", {
    method: "POST",
    body: JSON.stringify({ type: "user.created", data: { email: "leak@x.test" } }),
  });

describe("clerkWebhookHttp", () => {
  afterEach(() => vi.restoreAllMocks());

  it("syncs a verified event", async () => {
    const event = { type: "user.created", data: {} };
    const handle = vi.fn().mockResolvedValue("synced");
    const response = await clerkWebhookHttp(post(), {
      verify: vi.fn().mockResolvedValue(event),
      handle,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, data: { outcome: "synced" } });
    expect(handle).toHaveBeenCalledWith(event);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("refuses an unverifiable delivery without handling it", async () => {
    const handle = vi.fn();
    const response = await clerkWebhookHttp(post(), {
      verify: vi.fn().mockRejectedValue(new Error("bad signature")),
      handle,
    });

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("WEBHOOK_SIGNATURE_INVALID");
    expect(handle).not.toHaveBeenCalled();
  });

  it("answers 503 when the sync fails so Clerk retries", async () => {
    const response = await clerkWebhookHttp(post(), {
      verify: vi.fn().mockResolvedValue({ type: "user.created", data: {} }),
      handle: vi.fn().mockRejectedValue(new Error("CLERK_USER_SYNC_FAILED:08006")),
    });

    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("IDENTITY_SYNC_UNAVAILABLE");
  });

  it("only accepts POST", async () => {
    const verify = vi.fn();
    const response = await clerkWebhookHttp(
      new Request("https://bilikkebal.afes.my/api/webhooks/clerk"),
      { verify, handle: vi.fn() },
    );

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
    expect(verify).not.toHaveBeenCalled();
  });

  it("logs no payload or error detail", async () => {
    const lines: string[] = [];
    vi.spyOn(console, "info").mockImplementation((line: string) => void lines.push(line));

    await clerkWebhookHttp(post(), {
      verify: vi.fn().mockResolvedValue({ type: "user.created", data: {} }),
      handle: vi.fn().mockRejectedValue(new Error("leak@x.test")),
    });

    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain("leak@x.test");
    expect(JSON.parse(lines[0]!)).toMatchObject({
      operation: "identity.clerk_webhook",
      status: 503,
    });
  });
});
