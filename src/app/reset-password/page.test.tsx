import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import ResetPasswordPage from "./page";

test("shows the replacement password form for the recovery callback", async () => {
  render(await ResetPasswordPage({ searchParams: Promise.resolve({}) }));

  expect(screen.getByRole("heading", { name: "Set a new password" })).toBeInTheDocument();
  expect(screen.getByLabelText(/^New password/)).toBeInTheDocument();
});

test("an expired callback displays recovery guidance rather than a password form", async () => {
  render(await ResetPasswordPage({ searchParams: Promise.resolve({ status: "expired" }) }));

  expect(screen.getByRole("heading", { name: /link is invalid or expired/i })).toBeInTheDocument();
  expect(screen.queryByLabelText(/^New password/)).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Request another link/ })).toHaveAttribute(
    "href",
    "/recover",
  );
});
