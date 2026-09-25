import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RecoverForm } from "./recover-form";

function respondWith(body: unknown) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: async () => body } as Response));
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: /Send recovery link/ }));
}

function enterAddress() {
  fireEvent.change(screen.getByLabelText(/Email address/), {
    target: { value: "student@example.edu.my" },
  });
}

beforeEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

test("asks only for the email address", () => {
  render(<RecoverForm />);

  expect(screen.getByLabelText(/Email address/)).toBeInTheDocument();
  expect(screen.queryByLabelText(/Password/)).not.toBeInTheDocument();
});

test("does not call the operation without an address", () => {
  const fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);

  render(<RecoverForm />);
  submit();

  expect(fetchSpy).not.toHaveBeenCalled();
  expect(document.getElementById("email-error")).toHaveTextContent("Enter your email address.");
  expect(screen.getByRole("alert")).toHaveFocus();
});

test("posts the address to the recovery operation", async () => {
  respondWith({ ok: true, data: { accepted: true } });

  render(<RecoverForm />);
  enterAddress();
  submit();

  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

  const [path, init] = vi.mocked(fetch).mock.calls[0]!;
  expect(path).toBe("/api/auth/recovery");
  expect(JSON.parse(String(init?.body))).toEqual({ email: "student@example.edu.my" });
});

test("never reveals whether an account exists", async () => {
  respondWith({ ok: true, data: { accepted: true } });

  render(<RecoverForm />);
  enterAddress();
  submit();

  await waitFor(() => expect(screen.getByText(/If an account exists/i)).toBeInTheDocument());
  expect(screen.queryByText(/student@example\.edu\.my/)).not.toBeInTheDocument();
});

test("reports an unreachable server as offline", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

  render(<RecoverForm />);
  enterAddress();
  submit();

  await waitFor(() => expect(screen.getByText("Offline")).toBeInTheDocument());
});

test("disables the submit button with a cooldown timer after submitting", async () => {
  respondWith({ ok: true, data: { accepted: true } });

  render(<RecoverForm />);
  enterAddress();
  submit();

  await waitFor(() => {
    const button = screen.getByRole("button", { name: /Send recovery link/ });
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent(/wait/i);
  });
});

test("an accepted request shows the spam-folder hint", async () => {
  respondWith({ ok: true, data: { accepted: true } });

  render(<RecoverForm />);
  enterAddress();
  submit();

  expect(await screen.findByRole("note")).toHaveTextContent("Spam or Junk");
});
