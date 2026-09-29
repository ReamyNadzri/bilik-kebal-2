import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RecoverForm } from "./recover-form";
import { clerkHooks, clerkResult } from "@/features/presentation/test-support/clerk-hooks";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
  usePathname: () => "/recover",
}));

function fakeSignIn() {
  const signIn = {
    status: "needs_identifier" as string,
    create: vi.fn(async () => clerkResult()),
    finalize: vi.fn(
      async ({ navigate }: { navigate: (p: { decorateUrl: (u: string) => string }) => void }) => {
        navigate({ decorateUrl: (url) => url });
        return clerkResult();
      },
    ),
    resetPasswordEmailCode: {
      sendCode: vi.fn(async () => clerkResult()),
      verifyCode: vi.fn(async () => {
        signIn.status = "needs_new_password";
        return clerkResult();
      }),
      submitPassword: vi.fn(async () => {
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

function requestCode(email = "aina@student.uitm.edu.my") {
  fill(/Email address/, email);
  fireEvent.click(screen.getByRole("button", { name: "Send a reset code" }));
}

beforeEach(() => {
  replace.mockReset();
  refresh.mockReset();
});

test("asks only for the email address, and needs one", async () => {
  const signIn = fakeSignIn();
  render(<RecoverForm />);

  expect(screen.getAllByRole("textbox")).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Send a reset code" }));

  expect(await screen.findAllByText("Enter your email address.")).not.toHaveLength(0);
  expect(signIn.create).not.toHaveBeenCalled();
});

test("sends the code, then sets the new password and signs in", async () => {
  const signIn = fakeSignIn();
  render(<RecoverForm />);

  requestCode();

  expect(
    await screen.findByText("If an account exists for that address, a code is on its way"),
  ).toBeInTheDocument();
  expect(signIn.create).toHaveBeenCalledWith({ identifier: "aina@student.uitm.edu.my" });
  expect(signIn.resetPasswordEmailCode.sendCode).toHaveBeenCalledOnce();

  fill(/Code from the email/, "123456");
  fill(/New password/, "a-new-long-passphrase");
  fireEvent.click(screen.getByRole("button", { name: "Set new password" }));

  await waitFor(() => expect(replace).toHaveBeenCalledWith("/profile"));
  expect(signIn.resetPasswordEmailCode.verifyCode).toHaveBeenCalledWith({ code: "123456" });
  expect(signIn.resetPasswordEmailCode.submitPassword).toHaveBeenCalledWith({
    password: "a-new-long-passphrase",
  });
});

test("never reveals whether an account exists", async () => {
  const signIn = fakeSignIn();
  signIn.create.mockResolvedValue(clerkResult({ code: "form_identifier_not_found" }));
  render(<RecoverForm />);

  requestCode("nobody@x.test");

  expect(
    await screen.findByText("If an account exists for that address, a code is on its way"),
  ).toBeInTheDocument();
  expect(screen.queryByText(/not found|no account/i)).not.toBeInTheDocument();
  expect(signIn.resetPasswordEmailCode.sendCode).not.toHaveBeenCalled();
});

test("refuses a short new password before asking Clerk", async () => {
  const signIn = fakeSignIn();
  render(<RecoverForm />);

  requestCode();
  await screen.findByLabelText(/Code from the email/);
  fill(/Code from the email/, "123456");
  fill(/New password/, "short");
  fireEvent.click(screen.getByRole("button", { name: "Set new password" }));

  expect(await screen.findAllByText("Use a password of at least 12 characters.")).not.toHaveLength(
    0,
  );
  expect(signIn.resetPasswordEmailCode.verifyCode).not.toHaveBeenCalled();
});

test("reports an expired code and keeps the reset step open", async () => {
  const signIn = fakeSignIn();
  signIn.resetPasswordEmailCode.verifyCode.mockResolvedValue(
    clerkResult({ code: "verification_expired" }),
  );
  render(<RecoverForm />);

  requestCode();
  await screen.findByLabelText(/Code from the email/);
  fill(/Code from the email/, "123456");
  fill(/New password/, "a-new-long-passphrase");
  fireEvent.click(screen.getByRole("button", { name: "Set new password" }));

  expect(await screen.findAllByText("That code has expired. Send a new one.")).not.toHaveLength(0);
  expect(replace).not.toHaveBeenCalled();
});

test("reports an unreachable Clerk as offline", async () => {
  render(<RecoverForm />);

  requestCode();

  expect(await screen.findByText("The code could not be sent")).toBeInTheDocument();
});

test("hides an unknown address even when Clerk nests the refusal", async () => {
  const signIn = fakeSignIn();
  signIn.create.mockResolvedValue({
    error: { code: "api_response_error", errors: [{ code: "form_identifier_not_found" }] },
  } as never);
  render(<RecoverForm />);

  requestCode("nobody@x.test");

  expect(
    await screen.findByText("If an account exists for that address, a code is on its way"),
  ).toBeInTheDocument();
});
