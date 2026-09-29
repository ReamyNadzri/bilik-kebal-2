const clerk = vi.hoisted(() => ({ auth: vi.fn() }));
const syncCurrentClerkUser = vi.hoisted(() => vi.fn());

vi.mock("@clerk/nextjs/server", () => clerk);
vi.mock("@/lib/supabase/server", () => ({ syncCurrentClerkUser }));

import { POST } from "./route";

beforeEach(() => {
  clerk.auth.mockReset();
  syncCurrentClerkUser.mockReset().mockResolvedValue(undefined);
});

test("refuses a caller without a Clerk session", async () => {
  clerk.auth.mockResolvedValue({ userId: null });

  const response = await POST();

  expect(response.status).toBe(401);
  expect((await response.json()).code).toBe("AUTH_REQUIRED");
  expect(syncCurrentClerkUser).not.toHaveBeenCalled();
});

test("syncs the caller's own Clerk account", async () => {
  clerk.auth.mockResolvedValue({ userId: "user_2Hunter" });

  const response = await POST();

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true, data: { synced: true } });
  expect(syncCurrentClerkUser).toHaveBeenCalledOnce();
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
});

test("answers 503 when the sync fails, without detail", async () => {
  clerk.auth.mockResolvedValue({ userId: "user_2Hunter" });
  syncCurrentClerkUser.mockRejectedValue(new Error("CLERK_USER_SYNC_FAILED:08006"));

  const response = await POST();

  expect(response.status).toBe(503);
  expect(JSON.stringify(await response.json())).not.toContain("08006");
});
