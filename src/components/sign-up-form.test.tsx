import { fireEvent, render, screen, within } from "@testing-library/react";
import { waitFor } from "@testing-library/react";
import { SignUpForm } from "./sign-up-form";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function fill(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: /Create account/ }));
}

function completeForm() {
  fill(/^Display name/, "Aina");
  fill(/^Email address/, "student@example.edu.my");
  fill(/^Password/, "a-long-enough-passphrase");
  fill(/^Confirm password/, "a-long-enough-passphrase");
}

function respondWith(body: unknown) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => body } as Response));
}

beforeEach(() => {
  push.mockReset();
  vi.unstubAllGlobals();
});

test("asks for the display name the contract requires", () => {
  render(<SignUpForm />);

  expect(screen.getByLabelText(/^Display name/)).toBeInTheDocument();
});

test("summarises every missing field before calling the operation", () => {
  const fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);

  render(<SignUpForm />);
  submit();

  const summary = screen.getByRole("alert");
  expect(within(within(summary).getByRole("list")).getAllByRole("link")).toHaveLength(4);
  expect(fetchSpy).not.toHaveBeenCalled();
});

test("rejects a short password and a mismatched confirmation locally", () => {
  render(<SignUpForm />);
  fill(/^Display name/, "Aina");
  fill(/^Email address/, "student@example.edu.my");
  fill(/^Password/, "short");
  fill(/^Confirm password/, "different");
  submit();

  expect(document.getElementById("password-error")).toHaveTextContent(/at least 12 characters/i);
  expect(document.getElementById("confirm-password-error")).toHaveTextContent(/does not match/i);
});

test("posts the registration in the shape the contract defines", async () => {
  respondWith({ ok: true, data: { next: "verify_email" } });

  render(<SignUpForm />);
  completeForm();
  submit();

  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

  const [path, init] = vi.mocked(fetch).mock.calls[0]!;
  expect(path).toBe("/api/auth/sign-up");
  expect(JSON.parse(String(init?.body))).toEqual({
    displayName: "Aina",
    email: "student@example.edu.my",
    password: "a-long-enough-passphrase",
  });
});

test("sends the user to sign in after registration", async () => {
  respondWith({ ok: true, data: { next: "verify_email" } });

  render(<SignUpForm />);
  completeForm();
  submit();

  await waitFor(() => expect(push).toHaveBeenCalledWith("/sign-in"));
});

test("shows the operation's refusal without creating an account", async () => {
  respondWith({
    ok: false,
    code: "REGISTRATION_FAILED",
    message: "The account could not be created. Try again shortly.",
  });

  render(<SignUpForm />);
  completeForm();
  submit();

  await waitFor(() => expect(screen.getByText("No account was created")).toBeInTheDocument());
  expect(push).not.toHaveBeenCalled();
});

test("says that an account alone does not permit transacting", () => {
  render(<SignUpForm />);

  expect(screen.getByText(/institution verification/i)).toBeInTheDocument();
});
