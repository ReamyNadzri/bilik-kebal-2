import {
  authStateFor,
  can,
  hasConsoleAccess,
  isRestricted,
  INITIAL_AUTH_STATE,
} from "./auth-state";
import { anAccountViewModel } from "@/features/presentation/test-support/account-view-model";

describe("authStateFor", () => {
  test("an account is authenticated", () => {
    const state = authStateFor(anAccountViewModel());

    expect(state.status).toBe("authenticated");
    expect(state.error).toBeNull();
  });

  test("no account is unauthenticated rather than still loading", () => {
    const state = authStateFor(null);

    expect(state.status).toBe("unauthenticated");
    expect(state.account).toBeNull();
  });

  /**
   * The guarantee the whole no-flash design rests on: a screen seeded from the
   * server never starts in a state that would make it render a placeholder and
   * then replace it.
   */
  test("never starts in loading once the server has answered", () => {
    expect(INITIAL_AUTH_STATE.status).toBe("loading");
    expect(authStateFor(null).status).not.toBe("loading");
    expect(authStateFor(anAccountViewModel()).status).not.toBe("loading");
  });
});

describe("can", () => {
  test("reads the published capability rather than recomputing it", () => {
    const state = authStateFor(
      anAccountViewModel({
        capabilities: {
          browseMetadata: true,
          transact: true,
          submitClaim: false,
          download: false,
        },
      }),
    );

    expect(can(state, "transact")).toBe(true);
    expect(can(state, "submitClaim")).toBe(false);
  });

  /**
   * A capability is published as a decision, not derived here. An account that
   * looks institution verified but was published without the capability must
   * still be refused, because the identity module is the one that decided.
   */
  test("does not infer a capability from the trust state", () => {
    const state = authStateFor(
      anAccountViewModel({
        trust: { email: "verified", institution: "verified", restricted: false },
        capabilities: {
          browseMetadata: true,
          transact: false,
          submitClaim: false,
          download: false,
        },
      }),
    );

    expect(can(state, "transact")).toBe(false);
  });

  test("grants nothing without an account", () => {
    const state = authStateFor(null);

    for (const capability of ["browseMetadata", "transact", "submitClaim", "download"] as const) {
      expect(can(state, capability)).toBe(false);
    }
  });
});

describe("hasConsoleAccess", () => {
  test("follows the backend's navigation flag", () => {
    expect(
      hasConsoleAccess(authStateFor(anAccountViewModel({ console: { hasAccess: true } }))),
    ).toBe(true);
    expect(hasConsoleAccess(authStateFor(anAccountViewModel()))).toBe(false);
    expect(hasConsoleAccess(authStateFor(null))).toBe(false);
  });
});

describe("isRestricted", () => {
  test("reports a restricted account", () => {
    const restricted = anAccountViewModel({
      trust: { email: "verified", institution: "verified", restricted: true },
    });

    expect(isRestricted(authStateFor(restricted))).toBe(true);
    expect(isRestricted(authStateFor(anAccountViewModel()))).toBe(false);
  });
});
