import { onSessionExpired } from "./auth/session-expiry";
import { callOperation, readOperation } from "./call-operation";

function respondWith(body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ json: async () => body } as unknown as Response),
  );
}

let expiries: number;
let unsubscribe: () => void;

beforeEach(() => {
  vi.unstubAllGlobals();
  expiries = 0;
  unsubscribe = onSessionExpired(() => {
    expiries += 1;
  });
});

afterEach(() => {
  unsubscribe();
});

describe("readOperation", () => {
  test("reads without a body and refuses a cached answer", async () => {
    respondWith({ ok: true, data: { displayName: "Synthetic Tester" } });

    await readOperation("/api/identity/account", "AUTH_UNAVAILABLE");

    const [path, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(path).toBe("/api/identity/account");
    expect(init?.method).toBe("GET");
    expect(init?.body).toBeUndefined();
    expect(init?.cache).toBe("no-store");
  });

  test("returns the envelope the operation sent", async () => {
    respondWith({ ok: true, data: { displayName: "Synthetic Tester" } });

    const result = await readOperation<{ displayName: string }, "AUTH_UNAVAILABLE">(
      "/api/identity/account",
      "AUTH_UNAVAILABLE",
    );

    expect(result).toEqual({ ok: true, data: { displayName: "Synthetic Tester" } });
  });
});

describe("session expiry reporting", () => {
  test("announces an expired session when an operation says so", async () => {
    respondWith({ ok: false, code: "AUTH_REQUIRED", message: "Sign in to continue." });

    await callOperation("/api/identity/verification-requests", {}, "AUTH_UNAVAILABLE");

    expect(expiries).toBe(1);
  });

  test("announces it for a refused read as well as a refused write", async () => {
    respondWith({ ok: false, code: "AUTH_REQUIRED", message: "Sign in to continue." });

    await readOperation("/api/identity/account", "AUTH_UNAVAILABLE");

    expect(expiries).toBe(1);
  });

  /**
   * The failure this guards against: sign-in answers `401
   * INVALID_CREDENTIALS` for a wrong password. Reading the status rather than
   * the code would turn a mistyped password into a forced sign-out, and on a
   * protected screen into a redirect the viewer never asked for.
   */
  test("does not treat a rejected sign-in as an expired session", async () => {
    respondWith({
      ok: false,
      code: "INVALID_CREDENTIALS",
      message: "That email address and password do not match an account.",
    });

    await callOperation("/api/auth/sign-in", {}, "AUTH_UNAVAILABLE");

    expect(expiries).toBe(0);
  });

  /**
   * A step-up challenge happens inside a session that is still perfectly
   * valid; ending it would be the opposite of what the challenge asked for.
   */
  test("does not treat a step-up challenge as an expired session", async () => {
    respondWith({
      ok: false,
      code: "RECENT_AUTH_REQUIRED",
      message: "Sign in again to confirm it is you before continuing.",
    });

    await callOperation("/api/identity/verification-requests/evidence-url", {}, "AUTH_UNAVAILABLE");

    expect(expiries).toBe(0);
  });

  test("does not announce an expiry for a successful operation", async () => {
    respondWith({ ok: true, data: { signedOut: true } });

    await callOperation("/api/auth/sign-out", {}, "AUTH_UNAVAILABLE");

    expect(expiries).toBe(0);
  });

  /**
   * An unreachable server says nothing about the session. Signing the viewer
   * out over a dropped connection would lose their place for no reason.
   */
  test("does not announce an expiry when the server cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const result = await callOperation("/api/identity/account", {}, "AUTH_UNAVAILABLE");

    expect(expiries).toBe(0);
    expect(result.ok).toBe(false);
  });
});
