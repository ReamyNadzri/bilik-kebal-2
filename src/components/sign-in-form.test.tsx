import { fireEvent, render, screen, within } from "@testing-library/react";
import { SignInForm } from "./sign-in-form";

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

test("asks for an email address and a password", () => {
  render(<SignInForm />);

  expect(screen.getByLabelText(/Email address/)).toBeInTheDocument();
  expect(screen.getByLabelText(/Password/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
});

test("summarises both problems when the form is empty", () => {
  render(<SignInForm />);
  submit();

  const summary = screen.getByRole("alert");
  const links = within(within(summary).getByRole("list")).getAllByRole("link");

  expect(links).toHaveLength(2);
  expect(links[0]).toHaveAttribute("href", "#email");
  expect(links[1]).toHaveAttribute("href", "#password");
});

test("marks the failing fields invalid and describes each one", () => {
  render(<SignInForm />);
  submit();

  const email = screen.getByLabelText(/Email address/);

  expect(email).toHaveAttribute("aria-invalid", "true");
  expect(email.getAttribute("aria-describedby")).toContain("email-error");

  // The message appears twice by design — once in the summary, once beside the
  // field — so assert on the field's own error element rather than by text.
  expect(document.getElementById("email-error")).toHaveTextContent("Enter your email address.");
  expect(document.getElementById("password-error")).toHaveTextContent("Enter your password.");
});

test("moves focus to the summary so the problem is not missed", () => {
  render(<SignInForm />);
  submit();

  expect(screen.getByRole("alert")).toHaveFocus();
});

test("clears the summary once the fields are filled", () => {
  render(<SignInForm />);
  submit();
  expect(screen.getByRole("alert")).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText(/Email address/), {
    target: { value: "student@uitm.edu.my" },
  });
  fireEvent.change(screen.getByLabelText(/Password/), { target: { value: "a-long-passphrase" } });
  submit();

  expect(screen.queryByText("Enter your email address.")).not.toBeInTheDocument();
});

test("says no account is signed in because no backend is connected", () => {
  render(<SignInForm />);

  fireEvent.change(screen.getByLabelText(/Email address/), {
    target: { value: "student@uitm.edu.my" },
  });
  fireEvent.change(screen.getByLabelText(/Password/), { target: { value: "a-long-passphrase" } });
  submit();

  expect(screen.getByRole("status")).toHaveTextContent(/not connected/i);
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
