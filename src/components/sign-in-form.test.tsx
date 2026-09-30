import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SignInForm } from "./sign-in-form";
import { clerkHooks, clerkResult } from "@/features/presentation/test-support/clerk-hooks";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
  usePathname: () => "/sign-in",
}));

type Status = "needs_first_factor" | "needs_client_trust" | "needs_second_factor" | "complete";

/** A Clerk `SignInFuture` whose outcome each test scripts. */
function fakeSignIn(afterPassword: Status = "complete") {
  const signIn = {
    id: undefined as string | undefined,
    status: "needs_first_factor" as Status,
    firstFactorVerification: null as null | {
      strategy: string;
      status: string | null;
      error: unknown;
    },
    supportedSecondFactors: [{ strategy: "email_code" }],
    password: vi.fn(async () => {
      signIn.status = afterPassword;
      return clerkResult();
    }),
    sso: vi.fn(async () => clerkResult()),
    reset: vi.fn(async () => clerkResult()),
    finalize: vi.fn(
      async ({ navigate }: { navigate: (p: { decorateUrl: (u: string) => string }) => void }) => {
        navigate({ decorateUrl: (url) => url });
        return clerkResult();
      },
    ),
    mfa: {
      sendEmailCode: vi.fn(async () => clerkResult()),
      verifyEmailCode: vi.fn(async () => {
        signIn.status = "complete";
        return clerkResult();
      }),
    },
  };
  clerkHooks.signIn = signIn;
  return signIn;
}

function fill(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function signInWith(email = "student@example.edu.my", password = "a-long-passphrase") {
  fill(/Email address/, email);
  fill(/Password/, password);
  fireEvent.click(screen.getByRole("button", { name: /^Sign in$/ }));
}

beforeEach(() => {
  replace.mockReset();
  refresh.mockReset();
});

test("does not ask Clerk without both fields", async () => {
  const signIn = fakeSignIn();
  render(<SignInForm />);

  fireEvent.click(screen.getByRole("button", { name: /^Sign in$/ }));

  expect(await screen.findAllByText("Enter your email address.")).not.toHaveLength(0);
  expect(screen.getAllByText("Enter your password.")).not.toHaveLength(0);
  expect(signIn.password).not.toHaveBeenCalled();
});

test("signs in with Clerk and lands on the requested destination, replacing history", async () => {
  const signIn = fakeSignIn("complete");
  render(<SignInForm next="/wanted/abc" />);

  signInWith();

  await waitFor(() => expect(replace).toHaveBeenCalledWith("/wanted/abc"));
  expect(signIn.password).toHaveBeenCalledWith({
    emailAddress: "student@example.edu.my",
    password: "a-long-passphrase",
  });
  expect(refresh).toHaveBeenCalled();
});

test("falls back to the profile when no destination was requested", async () => {
  fakeSignIn("complete");
  render(<SignInForm />);

  signInWith();

  await waitFor(() => expect(replace).toHaveBeenCalledWith("/profile"));
});

test.each(["form_password_incorrect", "form_identifier_not_found"])(
  "answers %s the same way, never saying whether the account exists",
  async (code) => {
    const signIn = fakeSignIn();
    signIn.password.mockResolvedValue(clerkResult({ code, message: "Clerk's own wording" }));
    render(<SignInForm />);

    signInWith();

    expect(
      await screen.findAllByText("The email address or password is not correct."),
    ).not.toHaveLength(0);
    expect(screen.queryByText("Clerk's own wording")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  },
);

test("asks for the emailed code on a new device, then finishes signing in", async () => {
  const signIn = fakeSignIn("needs_client_trust");
  render(<SignInForm />);

  signInWith();

  expect(await screen.findByText("Check your email")).toBeInTheDocument();
  expect(signIn.mfa.sendEmailCode).toHaveBeenCalledOnce();
  expect(replace).not.toHaveBeenCalled();

  fill(/Code from the email/, "123456");
  fireEvent.click(screen.getByRole("button", { name: "Finish signing in" }));

  await waitFor(() => expect(replace).toHaveBeenCalledWith("/profile"));
  expect(signIn.mfa.verifyEmailCode).toHaveBeenCalledWith({ code: "123456" });
});

test("keeps the code step open when the code is wrong", async () => {
  const signIn = fakeSignIn("needs_client_trust");
  signIn.mfa.verifyEmailCode.mockResolvedValue(clerkResult({ code: "form_code_incorrect" }));
  render(<SignInForm />);

  signInWith();
  await screen.findByLabelText(/Code from the email/);
  fill(/Code from the email/, "000000");
  fireEvent.click(screen.getByRole("button", { name: "Finish signing in" }));

  expect(
    await screen.findAllByText("That code is not correct. Check the email and try again."),
  ).not.toHaveLength(0);
  expect(replace).not.toHaveBeenCalled();
});

test("says sign-in is unavailable when Clerk has not loaded", async () => {
  render(<SignInForm />);

  signInWith();

  expect(await screen.findByText("You were not signed in")).toBeInTheDocument();
  expect(screen.getByText(/Sign-in is unavailable right now/)).toBeInTheDocument();
});

test("starts Google sign-in through the SSO callback and marks the round trip", async () => {
  window.sessionStorage.clear();
  const signIn = fakeSignIn();
  render(<SignInForm next="/board" />);

  fireEvent.click(screen.getByRole("button", { name: /Continue with Google/ }));

  await waitFor(() =>
    expect(signIn.sso).toHaveBeenCalledWith({
      strategy: "oauth_google",
      redirectUrl: "/board",
      redirectCallbackUrl: "/sso-callback",
    }),
  );
  expect(Number(window.sessionStorage.getItem("vaultix_google_sign_in"))).toBeGreaterThan(0);
});

test("clears a leftover sign-in before starting Google, from the fresh attempt", async () => {
  const stale = fakeSignIn();
  stale.id = "sia_leftover";
  const fresh = fakeSignIn();
  clerkHooks.signIn = stale;
  // Clerk swaps in a new sign-in; the old object still holds the old attempt.
  stale.reset.mockImplementation(async () => {
    clerkHooks.signIn = fresh;
    return clerkResult();
  });
  render(<SignInForm next="/board" />);

  fireEvent.click(screen.getByRole("button", { name: /Continue with Google/ }));

  await waitFor(() => expect(fresh.sso).toHaveBeenCalledOnce());
  expect(stale.reset).toHaveBeenCalledOnce();
  expect(stale.sso).not.toHaveBeenCalled();
});

test("leaves 'Signing in…' when Google never starts", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  try {
    fakeSignIn();
    render(<SignInForm />);

    fireEvent.click(screen.getByRole("button", { name: /Continue with Google/ }));
    expect(await screen.findByRole("button", { name: "Signing in…" })).toBeDisabled();

    await vi.advanceTimersByTimeAsync(10_000);

    expect(await screen.findByText(/Google sign-in did not start/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Sign in$/ })).toBeEnabled();
  } finally {
    vi.useRealTimers();
  }
});

test("says nothing once the page has left for Google", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  try {
    fakeSignIn();
    render(<SignInForm />);

    fireEvent.click(screen.getByRole("button", { name: /Continue with Google/ }));
    await screen.findByRole("button", { name: "Signing in…" });
    fireEvent(window, new Event("pagehide"));
    await vi.advanceTimersByTimeAsync(10_000);

    expect(screen.queryByText(/Google sign-in did not start/)).not.toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});

test("reads the code Clerk nests inside its API error, so the wording stays neutral", async () => {
  const signIn = fakeSignIn();
  signIn.password.mockResolvedValue({
    error: {
      code: "api_response_error",
      message: "Couldn't find your account.",
      errors: [{ code: "form_identifier_not_found", message: "Couldn't find your account." }],
    },
  } as never);
  render(<SignInForm />);

  signInWith();

  expect(
    await screen.findAllByText("The email address or password is not correct."),
  ).not.toHaveLength(0);
  expect(screen.queryByText("Couldn't find your account.")).not.toBeInTheDocument();
});

test("asks for the device code even when Clerk lists no second factors yet", async () => {
  const signIn = fakeSignIn("needs_client_trust");
  (signIn as { supportedSecondFactors: unknown }).supportedSecondFactors = null;
  render(<SignInForm />);

  signInWith();

  expect(await screen.findByText("Check your email")).toBeInTheDocument();
  expect(signIn.mfa.sendEmailCode).toHaveBeenCalledOnce();
});

test("never stays on 'Signing in…' when Clerk throws", async () => {
  const signIn = fakeSignIn();
  signIn.password.mockRejectedValue(new TypeError("boom"));
  render(<SignInForm />);

  signInWith();

  expect(await screen.findByText("You were not signed in")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^Sign in$/ })).toBeEnabled();
  expect(screen.queryByText("boom")).not.toBeInTheDocument();
});

describe("arriving back from Google", () => {
  beforeEach(() => window.sessionStorage.setItem("vaultix_google_sign_in", String(Date.now())));
  afterEach(() => window.sessionStorage.clear());

  test("says why Clerk refused the Google sign-in", async () => {
    const signIn = fakeSignIn();
    signIn.firstFactorVerification = {
      strategy: "oauth_google",
      status: "failed",
      error: { code: "external_account_exists" },
    };
    render(<SignInForm />);

    expect(
      await screen.findByText(
        "This Google account is already linked to a different VAULTIX account.",
      ),
    ).toBeInTheDocument();
  });

  test("words a raw Google failure plainly instead of showing provider text", async () => {
    const signIn = fakeSignIn();
    signIn.firstFactorVerification = {
      strategy: "oauth_google",
      status: "failed",
      error: {
        code: "oauth_token_exchange_error",
        message: 'oauth: token exchange: oauth2: "invalid_client"',
      },
    };
    render(<SignInForm />);

    expect(
      await screen.findByText(
        "Google sign-in could not be completed. Try again, or sign in with your password.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/invalid_client/)).not.toBeInTheDocument();
  });

  test("says nothing about an old Google attempt on a later plain visit", async () => {
    window.sessionStorage.clear();
    const signIn = fakeSignIn();
    signIn.firstFactorVerification = {
      strategy: "oauth_google",
      status: "failed",
      error: { code: "external_account_exists" },
    };
    render(<SignInForm />);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText("You were not signed in")).not.toBeInTheDocument();
  });

  test("forgets a Google start older than ten minutes", async () => {
    window.sessionStorage.setItem("vaultix_google_sign_in", String(Date.now() - 11 * 60_000));
    const signIn = fakeSignIn();
    signIn.firstFactorVerification = {
      strategy: "oauth_google",
      status: "failed",
      error: { code: "external_account_exists" },
    };
    render(<SignInForm />);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText("You were not signed in")).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem("vaultix_google_sign_in")).toBeNull();
  });

  test("continues to the emailed code when Clerk needs one more step", async () => {
    const signIn = fakeSignIn();
    signIn.status = "needs_second_factor";
    signIn.firstFactorVerification = { strategy: "oauth_google", status: "verified", error: null };
    render(<SignInForm />);

    expect(await screen.findByText("Check your email")).toBeInTheDocument();
    expect(signIn.mfa.sendEmailCode).toHaveBeenCalledOnce();
  });

  test("finishes a Google sign-in Clerk already completed", async () => {
    const signIn = fakeSignIn();
    signIn.status = "complete";
    signIn.firstFactorVerification = { strategy: "oauth_google", status: "verified", error: null };
    render(<SignInForm next="/board" />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/board"));
  });

  test("ignores an old password attempt on a fresh visit", () => {
    const signIn = fakeSignIn();
    signIn.firstFactorVerification = {
      strategy: "password",
      status: "failed",
      error: { code: "form_password_incorrect" },
    };
    render(<SignInForm />);

    expect(screen.queryByText("You were not signed in")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Sign in$/ })).toBeEnabled();
  });
});

test("a page restored from the back/forward cache starts over", async () => {
  const signIn = fakeSignIn();
  signIn.sso.mockReturnValue(new Promise(() => {}) as never);
  render(<SignInForm />);

  fireEvent.click(screen.getByRole("button", { name: /Continue with Google/ }));
  expect(await screen.findByRole("button", { name: "Signing in…" })).toBeDisabled();

  const restored = new Event("pageshow") as PageTransitionEvent;
  Object.defineProperty(restored, "persisted", { value: true });
  fireEvent(window, restored);

  expect(await screen.findByRole("button", { name: /^Sign in$/ })).toBeEnabled();
});
