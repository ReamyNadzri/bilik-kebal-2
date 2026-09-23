import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ResetPasswordForm } from "./reset-password-form";

function fill(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: /Set new password/ }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test("requires matching strong passwords before sending a request", () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);

  render(<ResetPasswordForm />);
  fill(/^New password/, "weak");
  fill(/^Confirm new password/, "different");
  submit();

  expect(fetchMock).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent(/password/i);
});

test("posts the new password and confirms success", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ ok: true, data: { updated: true } }),
  });
  vi.stubGlobal("fetch", fetchMock);

  render(<ResetPasswordForm />);
  fill(/^New password/, "NewSecurePass123");
  fill(/^Confirm new password/, "NewSecurePass123");
  submit();

  await screen.findByRole("heading", { name: "Password updated" });
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/auth/reset-password",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ password: "NewSecurePass123" }),
    }),
  );
  expect(screen.getByRole("link", { name: /Sign in/ })).toHaveAttribute("href", "/sign-in");
});

test("posts email, 6-digit recovery code, and new password when entered", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ ok: true, data: { updated: true } }),
  });
  vi.stubGlobal("fetch", fetchMock);

  render(<ResetPasswordForm />);
  fill(/^Email address/, "student@example.edu.my");
  fill(/^6-digit recovery code/, "654321");
  fill(/^New password/, "NewSecurePass123");
  fill(/^Confirm new password/, "NewSecurePass123");
  submit();

  await screen.findByRole("heading", { name: "Password updated" });
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/auth/reset-password",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        password: "NewSecurePass123",
        email: "student@example.edu.my",
        token: "654321",
      }),
    }),
  );
});

test("offers a new recovery request when the link has expired", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        ok: false,
        code: "RECOVERY_LINK_INVALID",
        message: "This recovery link is invalid or expired. Request a new one.",
      }),
    }),
  );

  render(<ResetPasswordForm />);
  fill(/^New password/, "NewSecurePass123");
  fill(/^Confirm new password/, "NewSecurePass123");
  submit();

  await waitFor(() =>
    expect(
      screen.getByRole("heading", { name: /link is invalid or expired/i }),
    ).toBeInTheDocument(),
  );
  expect(screen.getByRole("link", { name: /Request another link/ })).toHaveAttribute(
    "href",
    "/recover",
  );
});
