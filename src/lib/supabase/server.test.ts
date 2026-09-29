import { startNewRequest } from "@/lib/test-support/request-cache";

const createServerClient = vi.hoisted(() => vi.fn());
const createClient = vi.hoisted(() => vi.fn());
const clerk = vi.hoisted(() => ({ auth: vi.fn(), currentUser: vi.fn() }));
const syncUser = vi.hoisted(() => vi.fn());

vi.mock("react", async (importOriginal) => {
  const { requestScopedCache } = await import("@/lib/test-support/request-cache");
  return { ...(await importOriginal<typeof import("react")>()), cache: requestScopedCache };
});
vi.mock("@supabase/ssr", () => ({ createServerClient }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));
vi.mock("@clerk/nextjs/server", () => clerk);
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: () => undefined }),
}));
vi.mock("./admin", () => ({ createSupabaseAdminClient: () => ({}) }));
vi.mock("@/modules/identity/repositories/supabase-clerk-user-sync-repository", () => ({
  SupabaseClerkUserSyncRepository: class {
    syncUser = syncUser;
  },
}));

import { getRequestSupabaseClient, getRequestUser } from "./server";

const user = { id: "00000000-0000-4000-8000-000000000001" };
const getUser = vi.fn();
const rpc = vi.fn();
const getToken = vi.fn();

const identityRow = {
  user_id: "00000000-0000-4000-8000-0000000000c1",
  public_id: "00000000-0000-4000-8000-0000000000p1",
  email: "hunter@student.uitm.edu.my",
  email_verified_at: "2026-09-29T12:00:00.000Z",
  created_at: "2026-09-01T00:00:00.000Z",
};

function signInWithClerk(fva: unknown = [3, -1]) {
  clerk.auth.mockResolvedValue({
    userId: "user_2Hunter",
    getToken,
    sessionClaims: { fva },
  });
}

beforeEach(() => {
  startNewRequest();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-test-key");
  getUser.mockReset().mockResolvedValue({ data: { user }, error: null });
  createServerClient.mockReset().mockImplementation(() => ({ auth: { getUser } }));
  rpc.mockReset().mockResolvedValue({ data: [identityRow], error: null });
  createClient.mockReset().mockImplementation(() => ({ rpc }));
  getToken.mockReset().mockResolvedValue("clerk-session-token");
  clerk.auth.mockReset().mockResolvedValue({ userId: null });
  clerk.currentUser.mockReset().mockResolvedValue(null);
  syncUser.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("without a Clerk session (Supabase Auth, transitional)", () => {
  test("shares one client and one Auth check between every loader in a request", async () => {
    const [first, second, client, sameClient] = await Promise.all([
      getRequestUser(),
      getRequestUser(),
      getRequestSupabaseClient(),
      getRequestSupabaseClient(),
    ]);

    expect(getUser).toHaveBeenCalledOnce();
    expect(createServerClient).toHaveBeenCalledOnce();
    expect(createClient).not.toHaveBeenCalled();
    expect(second).toBe(first);
    expect(sameClient).toBe(client);
    expect(first.data.user).toEqual(user);
  });

  test("checks the session again for the next request", async () => {
    await getRequestUser();
    startNewRequest();
    await getRequestUser();

    expect(getUser).toHaveBeenCalledTimes(2);
    expect(createServerClient).toHaveBeenCalledTimes(2);
  });

  test("passes a signed-out answer through unchanged", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    expect((await getRequestUser()).data.user).toBeNull();
  });
});

describe("with a Clerk session", () => {
  test("sends the Clerk session token instead of Supabase Auth cookies", async () => {
    signInWithClerk();
    await getRequestSupabaseClient();

    expect(createServerClient).not.toHaveBeenCalled();
    const [url, key, options] = createClient.mock.calls[0]!;
    expect([url, key]).toEqual(["https://project.supabase.test", "publishable-test-key"]);
    await expect(options.accessToken()).resolves.toBe("clerk-session-token");
    expect(options.auth).toEqual({ autoRefreshToken: false, persistSession: false });
  });

  test("reads the member through current_identity with the internal id", async () => {
    vi.useFakeTimers({ now: new Date("2026-09-29T12:10:00.000Z") });
    signInWithClerk([3, -1]);

    const result = await getRequestUser();

    expect(rpc).toHaveBeenCalledWith("current_identity");
    expect(result).toEqual({
      data: {
        user: {
          id: identityRow.user_id,
          email: identityRow.email,
          email_confirmed_at: identityRow.email_verified_at,
          last_sign_in_at: "2026-09-29T12:07:00.000Z",
          created_at: identityRow.created_at,
        },
      },
      error: null,
    });
    expect(syncUser).not.toHaveBeenCalled();
  });

  test.each([[[-1, -1]], [null], ["3"]])(
    "reports no recent password entry for fva %j",
    async (fva) => {
      signInWithClerk(fva);
      expect((await getRequestUser()).data.user?.last_sign_in_at).toBeNull();
    },
  );

  test("provisions an account the webhook has not reached yet", async () => {
    signInWithClerk();
    rpc
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: [identityRow], error: null });
    clerk.currentUser.mockResolvedValue({
      raw: {
        id: "user_2Hunter",
        external_id: null,
        primary_email_address_id: "idn_1",
        email_addresses: [
          {
            id: "idn_1",
            email_address: "hunter@student.uitm.edu.my",
            verification: { status: "verified" },
          },
        ],
        first_name: "Aina",
        last_name: null,
        username: null,
        updated_at: 1_790_000_000_000,
      },
    });

    const result = await getRequestUser();

    expect(syncUser).toHaveBeenCalledWith(
      expect.objectContaining({ clerkUserId: "user_2Hunter", emailVerified: true }),
    );
    expect(result.data.user?.id).toBe(identityRow.user_id);
  });

  test("treats a Clerk user that cannot be provisioned as signed out", async () => {
    signInWithClerk();
    rpc.mockResolvedValue({ data: [], error: null });

    expect(await getRequestUser()).toEqual({ data: { user: null }, error: null });
  });

  test("reports identity as unavailable instead of signed out when the read fails", async () => {
    signInWithClerk();
    rpc.mockResolvedValue({ data: null, error: { code: "08006" } });

    const result = await getRequestUser();

    expect(result.data.user).toBeNull();
    expect(result.error?.message).toBe("IDENTITY_UNAVAILABLE");
  });
});
