import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SignInForm } from "./sign-in-form";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function fill(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: /Sign in/ }));
}

function credentials() {
  fill(/Email address/, "student@example.edu.my");
  fill(/Password/, "a-long-passphrase");
}

function respondWith(body: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok, json: async () => body } as unknown as Response),
  );
}

beforeEach(() => {
  push.mockReset();
  vi.unstubAllGlobals();
});

test("does not call the operation until the fields are present", () => {
  const fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);

  render(<SignInForm />);
  submit();

  expect(fetchSpy).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent("There is a problem");
});

test("posts the credentials to the sign-in operation", async () => {
  respondWith({ ok: true, data: { next: "profile" } });

  render(<SignInForm />);
  credentials();
  submit();

  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

  const [path, init] = vi.mocked(fetch).mock.calls[0]!;
  expect(path).toBe("/api/auth/sign-in");
  expect(init?.method).toBe("POST");
  expect(JSON.parse(String(init?.body))).toEqual({
    email: "student@example.edu.my",
    password: "a-long-passphrase",
  });
});

test("moves to the profile once the operation succeeds", async () => {
  respondWith({ ok: true, data: { next: "profile" } });

  render(<SignInForm />);
  credentials();
  submit();

  await waitFor(() => expect(push).toHaveBeenCalledWith("/profile"));
});

test("shows the operation's own message when credentials are refused", async () => {
  respondWith({
    ok: false,
    code: "INVALID_CREDENTIALS",
    message: "That email address and password do not match an account.",
  });

  render(<SignInForm />);
  credentials();
  submit();

  await waitFor(() => expect(screen.getByText("You were not signed in")).toBeInTheDocument());
  expect(
    screen.getByText("That email address and password do not match an account."),
  ).toBeInTheDocument();
  expect(push).not.toHaveBeenCalled();
});

test("routes an unverified email to the verification screen instead of a field error", async () => {
  respondWith({
    ok: false,
    code: "EMAIL_NOT_VERIFIED",
    message: "Confirm your email address before signing in.",
  });

  render(<SignInForm />);
  credentials();
  submit();

  await waitFor(() =>
    expect(screen.getByText("Confirm your email address first")).toBeInTheDocument(),
  );
  expect(screen.getByRole("link", { name: "Resend the verification link" })).toHaveAttribute(
    "href",
    "/verify-email",
  );
});

test("attaches the operation's field errors to their fields", async () => {
  respondWith({
    ok: false,
    code: "VALIDATION_ERROR",
    message: "Check the highlighted fields and try again.",
    fieldErrors: { email: ["That is not a valid email address."] },
  });

  render(<SignInForm />);
  credentials();
  submit();

  await waitFor(() =>
    expect(document.getElementById("email-error")).toHaveTextContent(
      "That is not a valid email address.",
    ),
  );

  const summary = screen.getByRole("alert");
  expect(within(summary).getByRole("link")).toHaveAttribute("href", "#email");
});

test("reports an unreachable server as offline rather than as a refusal", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

  render(<SignInForm />);
  credentials();
  submit();

  await waitFor(() => expect(screen.getByText("Offline")).toBeInTheDocument());
  expect(push).not.toHaveBeenCalled();
});

test("offers recovery and registration routes", () => {
  render(<SignInForm />);

  expect(screen.getByRole("link", { name: "Forgot your password?" })).toHaveAttribute(
    "href",
    "/recover",
  );
  expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute(
    "href",
    "/sign-up",
  );
});
