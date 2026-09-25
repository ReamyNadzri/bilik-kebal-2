import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: { verifyOtp: vi.fn(), getUser: vi.fn() },
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: mocks.auth }),
}));

import { POST } from "./route";

const user = { id: "00000000-0000-4000-8000-000000000001" };

function post(fields: Record<string, string>) {
  return new Request("https://vaultix.example/api/auth/confirm", {
    method: "POST",
    body: new URLSearchParams(fields),
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("IDENTITY_PENDING_COOKIE_SECRET", "local-test-cookie-secret-with-more-than-32-chars");
  mocks.auth.verifyOtp.mockResolvedValue({ error: null });
  mocks.auth.getUser.mockResolvedValue({ data: { user }, error: null });
});

test("verifies an email link once and redirects to the verified state", async () => {
  const response = await POST(post({ token_hash: "abc", type: "email" }));
  expect(mocks.auth.verifyOtp).toHaveBeenCalledTimes(1);
  expect(mocks.auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "abc", type: "email" });
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe(
    "https://vaultix.example/verify-email?status=verified",
  );
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("set-cookie")).toBeNull();
});

test("recovery issues the grant cookie and goes to reset", async () => {
  const response = await POST(post({ token_hash: "abc", type: "recovery" }));
  expect(response.headers.get("location")).toBe("https://vaultix.example/reset-password");
  expect(response.headers.get("set-cookie")).toContain("vaultix_password_recovery=");
});

test("recovery without a resulting user fails closed", async () => {
  mocks.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
  const response = await POST(post({ token_hash: "abc", type: "recovery" }));
  expect(response.headers.get("location")).toBe(
    "https://vaultix.example/sign-in?error=recovery_failed",
  );
  expect(response.headers.get("set-cookie")).toBeNull();
});

test("an expired link goes to the expired state", async () => {
  mocks.auth.verifyOtp.mockResolvedValue({ error: { code: "otp_expired", status: 403 } });
  const response = await POST(post({ token_hash: "abc", type: "email" }));
  expect(response.headers.get("location")).toBe(
    "https://vaultix.example/verify-email?status=expired",
  );
});

test("a provider outage returns to the confirm page so the unspent link can be retried", async () => {
  mocks.auth.verifyOtp.mockResolvedValue({ error: { code: undefined, status: 503 } });
  const response = await POST(post({ token_hash: "abc", type: "email" }));
  expect(response.headers.get("location")).toBe(
    "https://vaultix.example/auth/confirm?token_hash=abc&type=email&status=unavailable",
  );
});

test("rejects unsupported types without calling Supabase", async () => {
  const response = await POST(post({ token_hash: "abc", type: "magiclink" }));
  expect(mocks.auth.verifyOtp).not.toHaveBeenCalled();
  expect(response.headers.get("location")).toBe(
    "https://vaultix.example/verify-email?status=invalid",
  );
});

test("keeps a safe next path through a retry and drops an unsafe one", async () => {
  mocks.auth.verifyOtp.mockResolvedValue({ error: { code: undefined, status: 500 } });
  const response = await POST(post({ token_hash: "abc", type: "email", next: "//evil.example" }));
  expect(response.headers.get("location")).not.toContain("evil");
});
