import { act, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { AuthProvider, useAuth } from "./auth-provider";
import { reportSessionExpired } from "./session-expiry";
import type { AccountViewModel } from "@/contracts";
import { anAccountViewModel } from "@/features/presentation/test-support/account-view-model";

const replace = vi.fn();
const refresh = vi.fn();
const pathname = vi.hoisted(() => ({ current: "/profile" }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
  usePathname: () => pathname.current,
}));

function respondWith(...bodies: unknown[]) {
  const mock = vi.fn();
  for (const body of bodies) {
    mock.mockResolvedValueOnce({ json: async () => body } as unknown as Response);
  }
  vi.stubGlobal("fetch", mock);
  return mock;
}

/** Surfaces the provider's state and actions to the assertions. */
function Probe() {
  const { can, hasConsoleAccess, refreshAccount, signIn, signOut, state } = useAuth();

  return (
    <div>
      <p data-testid="status">{state.status}</p>
      <p data-testid="name">{state.account?.displayName ?? "nobody"}</p>
      <p data-testid="error">{state.error ?? "none"}</p>
      <p data-testid="transact">{String(can("transact"))}</p>
      <p data-testid="console">{String(hasConsoleAccess)}</p>
      <button type="button" onClick={() => void signIn({ email: "a@b.my", password: "secret" })}>
        Sign in
      </button>
      <button type="button" onClick={() => void signOut()}>
        Sign out
      </button>
      <button type="button" onClick={() => void refreshAccount()}>
        Refresh
      </button>
    </div>
  );
}

function renderProvider(initialAccount: AccountViewModel | null, children: ReactNode = <Probe />) {
  return render(<AuthProvider initialAccount={initialAccount}>{children}</AuthProvider>);
}

beforeEach(() => {
  replace.mockReset();
  refresh.mockReset();
  pathname.current = "/profile";
  vi.unstubAllGlobals();
});

describe("seeding from the server", () => {
  /**
   * The whole no-flash design rests on this: the server already resolved the
   * account, so the first paint states the answer instead of a placeholder.
   */
  test("starts authenticated without a browser round trip", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    renderProvider(anAccountViewModel({ displayName: "Aina" }));

    expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    expect(screen.getByTestId("name")).toHaveTextContent("Aina");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("starts unauthenticated when the server resolved no account", () => {
    renderProvider(null);

    expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated");
  });

  test("publishes capabilities as the identity module decided them", () => {
    renderProvider(
      anAccountViewModel({
        capabilities: {
          browseMetadata: true,
          transact: true,
          submitClaim: true,
          download: true,
        },
        console: { hasAccess: true },
      }),
    );

    expect(screen.getByTestId("transact")).toHaveTextContent("true");
    expect(screen.getByTestId("console")).toHaveTextContent("true");
  });
});

describe("signing in", () => {
  test("re-reads the account before the caller navigates", async () => {
    const fetchMock = respondWith(
      { ok: true, data: { next: "profile" } },
      { ok: true, data: anAccountViewModel({ displayName: "Aina" }) },
    );

    renderProvider(null);
    act(() => screen.getByRole("button", { name: "Sign in" }).click());

    await waitFor(() => expect(screen.getByTestId("name")).toHaveTextContent("Aina"));
    expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/auth/sign-in");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/identity/account");
  });

  test("keeps the viewer signed out and explains a refusal", async () => {
    respondWith({
      ok: false,
      code: "INVALID_CREDENTIALS",
      message: "That email address and password do not match an account.",
    });

    renderProvider(null);
    act(() => screen.getByRole("button", { name: "Sign in" }).click());

    await waitFor(() =>
      expect(screen.getByTestId("error")).toHaveTextContent(
        "That email address and password do not match an account.",
      ),
    );
    expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated");
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("signing out", () => {
  test("clears the account and returns the viewer to the homepage", async () => {
    respondWith({ ok: true, data: { signedOut: true } });

    renderProvider(anAccountViewModel());
    act(() => screen.getByRole("button", { name: "Sign out" }).click());

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
    expect(replace).toHaveBeenCalledWith("/");
    expect(refresh).toHaveBeenCalled();
  });

  /**
   * A signed-out shell over a session that is still live on the server is the
   * one misreading of this screen with a real cost: the viewer walks away
   * believing they are signed out.
   */
  test("keeps the account on screen when sign-out fails", async () => {
    respondWith({
      ok: false,
      code: "AUTH_UNAVAILABLE",
      message: "Identity services are temporarily unavailable. Try again.",
    });

    renderProvider(anAccountViewModel({ displayName: "Aina" }));
    act(() => screen.getByRole("button", { name: "Sign out" }).click());

    await waitFor(() =>
      expect(screen.getByTestId("error")).toHaveTextContent(
        "Identity services are temporarily unavailable. Try again.",
      ),
    );
    expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    expect(screen.getByTestId("name")).toHaveTextContent("Aina");
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("an expired session", () => {
  test("signs the viewer out and returns them to their place afterwards", async () => {
    renderProvider(anAccountViewModel());

    act(() => reportSessionExpired());

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
    expect(replace).toHaveBeenCalledWith("/sign-in?next=%2Fprofile&expired=1");
    expect(screen.getByTestId("error")).toHaveTextContent("Your session ended");
  });

  /**
   * Loop prevention. An anonymous visitor reading a public screen triggers
   * `AUTH_REQUIRED` from any account-shaped read; bouncing them to sign-in
   * would make the public part of the marketplace unreadable.
   */
  test("leaves a viewer who was never signed in where they are", async () => {
    pathname.current = "/board";
    renderProvider(null);

    act(() => reportSessionExpired());

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
    expect(replace).not.toHaveBeenCalled();
  });

  /** Loop prevention: the sign-in screen must never redirect to itself. */
  test("does not redirect away from the screens that exist to sign in", async () => {
    pathname.current = "/sign-in";
    renderProvider(anAccountViewModel());

    act(() => reportSessionExpired());

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
    expect(replace).not.toHaveBeenCalled();
  });

  test("redirects only once however many operations were refused", async () => {
    renderProvider(anAccountViewModel());

    act(() => {
      reportSessionExpired();
      reportSessionExpired();
      reportSessionExpired();
    });

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
    expect(replace).toHaveBeenCalledTimes(1);
  });
});

describe("refreshing the account", () => {
  test("forgets the account when identity says nobody is signed in", async () => {
    respondWith({ ok: false, code: "AUTH_REQUIRED", message: "Sign in to continue." });

    renderProvider(anAccountViewModel());
    act(() => screen.getByRole("button", { name: "Refresh" }).click());

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
  });

  /**
   * An outage is not a sign-out. Forgetting the account here would end a
   * session that is still perfectly valid the moment identity recovers.
   */
  test("keeps the account through a transient outage", async () => {
    respondWith({
      ok: false,
      code: "AUTH_UNAVAILABLE",
      message: "Accounts are unavailable right now. Try again shortly.",
    });

    renderProvider(anAccountViewModel({ displayName: "Aina" }));
    act(() => screen.getByRole("button", { name: "Refresh" }).click());

    await waitFor(() =>
      expect(screen.getByTestId("error")).toHaveTextContent("Accounts are unavailable right now."),
    );
    expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
    expect(screen.getByTestId("name")).toHaveTextContent("Aina");
  });
});

test("refuses to be used outside a provider", () => {
  const noise = vi.spyOn(console, "error").mockImplementation(() => {});

  expect(() => render(<Probe />)).toThrow(/AuthProvider/);

  noise.mockRestore();
});
