import { startNewRequest } from "@/lib/test-support/request-cache";

const server = vi.hoisted(() => ({
  getRequestSupabaseClient: vi.fn(),
  getRequestUser: vi.fn(),
}));
const readAccount = vi.hoisted(() => vi.fn());

vi.mock("react", async (importOriginal) => {
  const { requestScopedCache } = await import("@/lib/test-support/request-cache");
  return { ...(await importOriginal<typeof import("react")>()), cache: requestScopedCache };
});
vi.mock("@/lib/supabase/server", () => server);
vi.mock("../repositories/supabase-identity-read-repository", () => ({
  SupabaseIdentityReadRepository: class {
    readAccount = readAccount;
  },
}));

import { loadAccountContext, loadAccountViewModel } from "./identity-read";

const user = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "hunter@student.uitm.edu.my",
  email_confirmed_at: "2026-09-20T08:00:00.000Z",
};

const record = {
  displayName: "Synthetic Hunter",
  publicId: "synthetic-hunter",
  avatarUrl: null,
  avatarPreset: null,
  email: user.email,
  joinedAt: "2026-09-20T08:00:00.000Z",
  emailConfirmedAt: user.email_confirmed_at,
  hasActiveRestriction: false,
  restrictionExpiresAt: null,
  hasConsoleAccess: false,
  institution: null,
  institutionVerificationState: "unverified",
  latestVerificationRequest: null,
};

beforeEach(() => {
  startNewRequest();
  server.getRequestSupabaseClient.mockReset().mockResolvedValue({});
  server.getRequestUser.mockReset().mockResolvedValue({ data: { user }, error: null });
  readAccount.mockReset().mockResolvedValue(record);
});

test("answers null without reading identity when nobody is signed in", async () => {
  server.getRequestUser.mockResolvedValue({ data: { user: null }, error: null });

  expect(await loadAccountContext()).toBeNull();
  expect(await loadAccountViewModel()).toBeNull();
  expect(readAccount).not.toHaveBeenCalled();
});

test("reads the account once however many loaders ask for it in one request", async () => {
  const [layout, guard, viewModel] = await Promise.all([
    loadAccountContext(),
    loadAccountContext(),
    loadAccountViewModel(),
  ]);

  expect(readAccount).toHaveBeenCalledOnce();
  expect(server.getRequestUser).toHaveBeenCalledOnce();
  expect(guard).toBe(layout);
  expect(layout).toEqual({ record, user });
  expect(viewModel?.displayName).toBe("Synthetic Hunter");
});

test("reads the account again for the next request", async () => {
  await loadAccountContext();
  startNewRequest();
  await loadAccountContext();

  expect(readAccount).toHaveBeenCalledTimes(2);
});

test("gives every caller in the request the same identity failure", async () => {
  readAccount.mockRejectedValue(new Error("Identity read failed"));

  await expect(loadAccountContext()).rejects.toThrow("Identity read failed");
  await expect(loadAccountViewModel()).rejects.toThrow("Identity read failed");
  expect(readAccount).toHaveBeenCalledOnce();
});
