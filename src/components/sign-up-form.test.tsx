import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SignUpForm } from "./sign-up-form";
import { clerkHooks, clerkResult } from "@/features/presentation/test-support/clerk-hooks";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
  usePathname: () => "/sign-up",
}));

type Status = "missing_requirements" | "complete";

/** A Clerk `SignUpFuture` that needs the emailed code before it completes. */
function fakeSignUp() {
  const signUp = {
    status: "missing_requirements" as Status,
    password: vi.fn(async () => clerkResult()),
    sso: vi.fn(async () => clerkResult()),
    finalize: vi.fn(
      async ({ navigate }: { navigate: (p: { decorateUrl: (u: string) => string }) => void }) => {
        navigate({ decorateUrl: (url) => url });
        return clerkResult();
      },
    ),
    verifications: {
      sendEmailCode: vi.fn(async () => clerkResult()),
      verifyEmailCode: vi.fn(async () => {
        signUp.status = "complete";
        return clerkResult();
      }),
    },
  };
  clerkHooks.signUp = signUp;
  return signUp;
}

function fill(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function register(password = "a-long-passphrase") {
  fill(/Display name/, "Aina");
  fill(/Email address/, "aina@student.uitm.edu.my");
  fill(/^Password/, password);
  fill(/Confirm password/, password);
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
}

beforeEach(() => {
  replace.mockReset();
  refresh.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ json: async () => ({ ok: true, data: { synced: true } }) })),
  );
});

afterEach(() => vi.unstubAllGlobals());

test("checks the fields before asking Clerk", async () => {
  const signUp = fakeSignUp();
  render(<SignUpForm />);

  fill(/Display name/, "Aina");
  fill(/Email address/, "aina@x.test");
  fill(/^Password/, "short");
  fill(/Confirm password/, "different");
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));

  expect(await screen.findAllByText("Use a password of at least 12 characters.")).not.toHaveLength(
    0,
  );
  expect(screen.getAllByText("This does not match the password you entered.")).not.toHaveLength(0);
  expect(signUp.password).not.toHaveBeenCalled();
});

test("creates the account, asks for the emailed code, then signs in to the profile", async () => {
  const signUp = fakeSignUp();
  render(<SignUpForm />);

  register();

  expect(await screen.findByText("Check your email")).toBeInTheDocument();
  expect(signUp.password).toHaveBeenCalledWith({
    emailAddress: "aina@student.uitm.edu.my",
    password: "a-long-passphrase",
    firstName: "Aina",
  });
  expect(signUp.verifications.sendEmailCode).toHaveBeenCalledOnce();

  fill(/Code from the email/, "123456");
  fireEvent.click(screen.getByRole("button", { name: "Confirm and create account" }));

  await waitFor(() => expect(replace).toHaveBeenCalledWith("/profile"));
  expect(signUp.verifications.verifyEmailCode).toHaveBeenCalledWith({ code: "123456" });
  // The account reaches VAULTIX before the first page asks for it.
  expect(fetch).toHaveBeenCalledWith("/api/identity/clerk-sync", { method: "POST" });
});

test("explains an address that already has an account", async () => {
  const signUp = fakeSignUp();
  signUp.password.mockResolvedValue(clerkResult({ code: "form_identifier_exists" }));
  render(<SignUpForm />);

  register();

  expect(
    await screen.findAllByText("An account already uses this email address. Sign in instead."),
  ).not.toHaveLength(0);
  expect(signUp.verifications.sendEmailCode).not.toHaveBeenCalled();
});

test("explains a breached password in plain words", async () => {
  const signUp = fakeSignUp();
  signUp.password.mockResolvedValue(clerkResult({ code: "form_password_pwned" }));
  render(<SignUpForm />);

  register();

  expect(await screen.findAllByText(/appeared in a data breach/)).not.toHaveLength(0);
});

test("keeps the code step open for a wrong code and can send a new one", async () => {
  const signUp = fakeSignUp();
  signUp.verifications.verifyEmailCode.mockResolvedValue(
    clerkResult({ code: "form_code_incorrect" }),
  );
  render(<SignUpForm />);

  register();
  await screen.findByLabelText(/Code from the email/);
  fill(/Code from the email/, "000000");
  fireEvent.click(screen.getByRole("button", { name: "Confirm and create account" }));

  expect(await screen.findAllByText(/That code is not correct/)).not.toHaveLength(0);
  expect(replace).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Send a new code" }));
  expect(await screen.findByRole("status")).toHaveTextContent("A new code is on its way.");
  expect(signUp.verifications.sendEmailCode).toHaveBeenCalledTimes(2);
});

test("leaves room for Clerk's bot check", () => {
  fakeSignUp();
  const { container } = render(<SignUpForm />);

  expect(container.querySelector("#clerk-captcha")).not.toBeNull();
});
