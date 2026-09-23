import { beforeEach, expect, test, vi } from "vitest";
import { createPasswordRecoveryGrant } from "@/modules/identity/services/password-recovery-grant";

const mocks = vi.hoisted(() => ({
  auth: {
    getUser: vi.fn(),
    updateUser: vi.fn(),
  },
  cookieStore: {
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("next/headers", () => ({ cookies: async () => mocks.cookieStore }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: mocks.auth }),
  getApplicationUrl: () => "https://vaultix.example",
}));

import { POST } from "./route";

const secret = "local-test-cookie-secret-with-more-than-32-chars";
const user = { id: "00000000-0000-4000-8000-000000000001" };

function request() {
  return new Request("https://vaultix.example/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "NewSecurePass123" }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "test");
  mocks.auth.getUser.mockResolvedValue({ data: { user }, error: null });
  mocks.auth.updateUser.mockResolvedValue({ error: null });
  mocks.cookieStore.get.mockReturnValue(undefined);
});

test("does not update a password for a normal session without a recovery grant", async () => {
  const response = await POST(request());

  expect(response.status).toBe(410);
  expect(mocks.auth.updateUser).not.toHaveBeenCalled();
});

test("updates only the grant-bound account password and clears the recovery grant", async () => {
  vi.stubEnv("IDENTITY_PENDING_COOKIE_SECRET", secret);
  mocks.cookieStore.get.mockReturnValue({
    value: createPasswordRecoveryGrant(user.id, secret),
  });

  const response = await POST(request());

  expect(response.status).toBe(200);
  expect(mocks.auth.updateUser).toHaveBeenCalledWith({ password: "NewSecurePass123" });
  expect(mocks.cookieStore.delete).toHaveBeenCalledWith("vaultix_password_recovery");
});
