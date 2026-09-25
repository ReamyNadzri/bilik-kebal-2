import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { EmailLinkConfirm } from "./email-link-confirm";

test("an email link shows a confirm button that posts the token", () => {
  const { container } = render(
    <EmailLinkConfirm tokenHash="abc" type="email" next={null} unavailable={false} />,
  );
  const button = screen.getByRole("button", { name: "Confirm my email" });
  const form = button.closest("form");
  expect(form).toHaveAttribute("method", "post");
  expect(form).toHaveAttribute("action", "/api/auth/confirm");
  expect(container.querySelector('input[name="token_hash"]')).toHaveValue("abc");
  expect(container.querySelector('input[name="type"]')).toHaveValue("email");
  expect(container.querySelector('input[name="next"]')).toBeNull();
});

test("a recovery link shows a reset button and carries next", () => {
  const { container } = render(
    <EmailLinkConfirm tokenHash="abc" type="recovery" next="/profile" unavailable={false} />,
  );
  expect(screen.getByRole("button", { name: "Reset my password" })).toBeInTheDocument();
  expect(container.querySelector('input[name="next"]')).toHaveValue("/profile");
});

test("explains why a button press is needed", () => {
  render(<EmailLinkConfirm tokenHash="abc" type="email" next={null} unavailable={false} />);
  expect(screen.getByText(/security scanners/i)).toBeInTheDocument();
});

test("an invalid link offers a way to get a new one and no submit button", () => {
  render(<EmailLinkConfirm tokenHash={null} type={null} next={null} unavailable={false} />);
  expect(screen.getByRole("alert")).toHaveTextContent("This link cannot be used");
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.getByRole("link", { name: "Request a new link" })).toHaveAttribute(
    "href",
    "/verify-email",
  );
  expect(screen.getByRole("link", { name: "Reset your password" })).toHaveAttribute(
    "href",
    "/recover",
  );
});

test("the unavailable state keeps the button so the unspent link can be retried", () => {
  render(<EmailLinkConfirm tokenHash="abc" type="email" next={null} unavailable />);
  expect(screen.getByRole("status")).toHaveTextContent(/could not reach/i);
  expect(screen.getByRole("status")).toHaveTextContent(/has not been used/i);
  expect(screen.getByRole("button", { name: "Confirm my email" })).toBeInTheDocument();
});
