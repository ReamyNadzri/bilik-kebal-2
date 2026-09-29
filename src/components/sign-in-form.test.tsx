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
    status: "needs_first_factor" as Status,
    supportedSecondFactors: [{ strategy: "email_code" }],
    password: vi.fn(async () => {
      signIn.status = afterPassword;
      return clerkResult();
    }),
    sso: vi.fn(async () => clerkResult()),
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

test("starts Google sign-in through the SSO callback", async () => {
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
});
