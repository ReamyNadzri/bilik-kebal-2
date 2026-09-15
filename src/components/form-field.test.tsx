import { render, screen } from "@testing-library/react";
import { FormField } from "./form-field";

test("associates the label with its control", () => {
  render(<FormField id="email" label="Email address" type="email" />);

  const input = screen.getByLabelText("Email address");

  expect(input).toHaveAttribute("id", "email");
  expect(input).toHaveAttribute("type", "email");
});

test("links a hint to the control so it is announced", () => {
  render(
    <FormField id="password" label="Password" type="password" hint="At least 12 characters." />,
  );

  const input = screen.getByLabelText("Password");
  const describedBy = input.getAttribute("aria-describedby");

  expect(describedBy).toContain("password-hint");
  expect(screen.getByText("At least 12 characters.")).toHaveAttribute("id", "password-hint");
});

test("links an error to the control and marks it invalid", () => {
  render(
    <FormField id="email" label="Email address" type="email" error="Enter your email address." />,
  );

  const input = screen.getByLabelText("Email address");

  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(input.getAttribute("aria-describedby")).toContain("email-error");
  expect(screen.getByText("Enter your email address.")).toHaveAttribute("id", "email-error");
});

test("is not marked invalid when there is no error", () => {
  render(<FormField id="email" label="Email address" type="email" />);

  expect(screen.getByLabelText("Email address")).not.toHaveAttribute("aria-invalid", "true");
});

test("announces both hint and error when both are present", () => {
  render(
    <FormField
      id="password"
      label="Password"
      type="password"
      hint="At least 12 characters."
      error="Password is too short."
    />,
  );

  const describedBy = screen.getByLabelText("Password").getAttribute("aria-describedby") ?? "";

  expect(describedBy).toContain("password-hint");
  expect(describedBy).toContain("password-error");
});

test("states that a field is required in words, not by a symbol alone", () => {
  render(<FormField id="email" label="Email address" type="email" required />);

  expect(screen.getByText("(required)")).toBeInTheDocument();
  expect(screen.getByLabelText(/Email address/)).toBeRequired();
});
