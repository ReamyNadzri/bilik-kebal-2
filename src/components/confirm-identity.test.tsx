import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConfirmIdentity } from "./confirm-identity";
import { clerkHooks } from "@/features/presentation/test-support/clerk-hooks";

function fakeSession() {
  const session = {
    startVerification: vi.fn(async () => ({ status: "needs_first_factor" })),
    attemptFirstFactorVerification: vi.fn(async () => ({ status: "complete" })),
    getToken: vi.fn(async () => "fresh-token"),
  };
  clerkHooks.session = session;
  return session;
}

function confirm(password = "the-password") {
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm and continue" }));
}

afterEach(() => vi.unstubAllGlobals());

describe("with a Clerk session", () => {
  test("reverifies the password, refreshes the token, then continues", async () => {
    const session = fakeSession();
    const onConfirmed = vi.fn();
    vi.stubGlobal("fetch", vi.fn());
    render(<ConfirmIdentity purpose="view this evidence" onConfirmed={onConfirmed} />);

    confirm();

    await waitFor(() => expect(onConfirmed).toHaveBeenCalledOnce());
    expect(session.startVerification).toHaveBeenCalledWith({ level: "first_factor" });
    expect(session.attemptFirstFactorVerification).toHaveBeenCalledWith({
      strategy: "password",
      password: "the-password",
    });
    // The retried action must carry the new verification age.
    expect(session.getToken).toHaveBeenCalledWith({ skipCache: true });
    expect(fetch).not.toHaveBeenCalled();
  });

  test("says so for a wrong password and does not continue", async () => {
    const session = fakeSession();
    session.attemptFirstFactorVerification.mockRejectedValue({
      errors: [{ code: "form_password_incorrect", message: "Password is incorrect." }],
    });
    const onConfirmed = vi.fn();
    render(<ConfirmIdentity purpose="record a decision" onConfirmed={onConfirmed} />);

    confirm();

    expect(await screen.findByRole("alert")).toHaveTextContent("That password is not correct.");
    expect(onConfirmed).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });

  test("explains an account that signs in with Google and has no password", async () => {
    const session = fakeSession();
    session.attemptFirstFactorVerification.mockRejectedValue({
      errors: [{ code: "strategy_for_user_invalid" }],
    });
    render(<ConfirmIdentity purpose="record a decision" onConfirmed={vi.fn()} />);

    confirm();

    expect(await screen.findByRole("alert")).toHaveTextContent(/signs in with Google/);
  });
});

test("a session still on Supabase Auth confirms through the old route", async () => {
  const fetchMock = vi.fn(async () => ({
    json: async () => ({ ok: true, data: { next: "profile" } }),
  }));
  vi.stubGlobal("fetch", fetchMock);
  const onConfirmed = vi.fn();
  render(<ConfirmIdentity purpose="view this evidence" onConfirmed={onConfirmed} />);

  confirm();

  await waitFor(() => expect(onConfirmed).toHaveBeenCalledOnce());
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/auth/reauthenticate",
    expect.objectContaining({ method: "POST" }),
  );
});

test("asks for the password before checking anything", async () => {
  const session = fakeSession();
  render(<ConfirmIdentity purpose="view this evidence" onConfirmed={vi.fn()} />);

  fireEvent.click(screen.getByRole("button", { name: "Confirm and continue" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Enter your password.");
  expect(session.startVerification).not.toHaveBeenCalled();
});
