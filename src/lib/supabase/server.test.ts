import { startNewRequest } from "@/lib/test-support/request-cache";

const createServerClient = vi.hoisted(() => vi.fn());

vi.mock("react", async (importOriginal) => {
  const { requestScopedCache } = await import("@/lib/test-support/request-cache");
  return { ...(await importOriginal<typeof import("react")>()), cache: requestScopedCache };
});
vi.mock("@supabase/ssr", () => ({ createServerClient }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: () => undefined }),
}));

import { getRequestSupabaseClient, getRequestUser } from "./server";

const user = { id: "00000000-0000-4000-8000-000000000001" };
const getUser = vi.fn();

beforeEach(() => {
  startNewRequest();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-test-key");
  getUser.mockReset().mockResolvedValue({ data: { user }, error: null });
  createServerClient.mockReset().mockImplementation(() => ({ auth: { getUser } }));
});

afterEach(() => vi.unstubAllEnvs());

test("shares one client and one Auth check between every loader in a request", async () => {
  const [first, second, client, sameClient] = await Promise.all([
    getRequestUser(),
    getRequestUser(),
    getRequestSupabaseClient(),
    getRequestSupabaseClient(),
  ]);

  expect(getUser).toHaveBeenCalledOnce();
  expect(createServerClient).toHaveBeenCalledOnce();
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
