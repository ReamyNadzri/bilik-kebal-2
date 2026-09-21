import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SignInForm } from "./sign-in-form";
import { AuthProvider } from "@/features/presentation/auth/auth-provider";
import { anAccountViewModel } from "@/features/presentation/test-support/account-view-model";

const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
  usePathname: () => "/sign-in",
}));

function renderForm(props: Partial<React.ComponentProps<typeof SignInForm>> = {}) {
  return render(
    <AuthProvider initialAccount={null}>
      <SignInForm {...props} />
    </AuthProvider>,
  );
}

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

/**
 * A successful sign-in is two operations: the sign-in itself, then the account
 * re-read that lets the shell know who is signed in before the form navigates.
 */
function respondWithSuccess() {
  const mock = vi
    .fn()
    .mockResolvedValueOnce({ json: async () => ({ ok: true, data: { next: "profile" } }) })
    .mockResolvedValueOnce({ json: async () => ({ ok: true, data: anAccountViewModel() }) });

  vi.stubGlobal("fetch", mock);
  return mock;
}

beforeEach(() => {
  replace.mockReset();
  refresh.mockReset();
  vi.unstubAllGlobals();
});

test("does not call the operation until the fields are present", () => {
  const fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);

  renderForm();
  submit();

  expect(fetchSpy).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent("There is a problem");
});

test("posts the credentials to the sign-in operation", async () => {
  const fetchMock = respondWithSuccess();

  renderForm();
  credentials();
  submit();

  await waitFor(() => expect(fetchMock).toHaveBeenCalled());

  const [path, init] = fetchMock.mock.calls[0]!;
  expect(path).toBe("/api/auth/sign-in");
  expect(init?.method).toBe("POST");
  expect(JSON.parse(String(init?.body))).toEqual({
    email: "student@example.edu.my",
    password: "a-long-passphrase",
  });
});

test("moves to the profile once the operation succeeds", async () => {
  respondWithSuccess();

  renderForm();
  credentials();
  submit();

  await waitFor(() => expect(replace).toHaveBeenCalledWith("/profile"));
});

describe("returning the viewer to where they were", () => {
  test("lands on the destination that was requested", async () => {
    respondWithSuccess();

    renderForm({ next: "/wanted/csc510-final-exam-notes" });
    credentials();
    submit();

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/wanted/csc510-final-exam-notes"));
  });

  /**
   * `replace` rather than `push`: a back button that returns to a sign-in form
   * which now redirects away is a dead end in the history stack.
   */
  test("replaces the sign-in screen in history rather than stacking on it", async () => {
    respondWithSuccess();

    renderForm({ next: "/console" });
    credentials();
    submit();

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/console"));
    expect(refresh).toHaveBeenCalled();
  });

  test("falls back to the profile when no destination was requested", async () => {
    respondWithSuccess();

    renderForm();
    credentials();
    submit();

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/profile"));
  });
});

test("shows the operation's own message when credentials are refused", async () => {
  respondWith({
    ok: false,
    code: "INVALID_CREDENTIALS",
    message: "That email address and password do not match an account.",
  });

  renderForm();
  credentials();
  submit();

  await waitFor(() => expect(screen.getByText("You were not signed in")).toBeInTheDocument());
  expect(
    screen.getByText("That email address and password do not match an account."),
  ).toBeInTheDocument();
  expect(replace).not.toHaveBeenCalled();
});

test("routes an unverified email to the verification screen instead of a field error", async () => {
  respondWith({
    ok: false,
    code: "EMAIL_NOT_VERIFIED",
    message: "Confirm your email address before signing in.",
  });

  renderForm();
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

  renderForm();
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

  renderForm();
  credentials();
  submit();

  await waitFor(() => expect(screen.getByText("Offline")).toBeInTheDocument());
  expect(replace).not.toHaveBeenCalled();
});

test("offers recovery and registration routes", () => {
  renderForm();

  expect(screen.getByRole("link", { name: "Forgot your password?" })).toHaveAttribute(
    "href",
    "/recover",
  );
  expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute(
    "href",
    "/sign-up",
  );
});
