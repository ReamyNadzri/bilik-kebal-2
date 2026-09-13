import { fireEvent, render, screen, within } from "@testing-library/react";
import { SignUpForm } from "./sign-up-form";

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
}

function fill(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

test("asks for an email address and a password twice", () => {
  render(<SignUpForm />);

  expect(screen.getByLabelText(/^Email address/)).toBeInTheDocument();
  expect(screen.getByLabelText(/^Password/)).toBeInTheDocument();
  expect(screen.getByLabelText(/^Confirm password/)).toBeInTheDocument();
});

test("summarises every missing field", () => {
  render(<SignUpForm />);
  submit();

  const summary = screen.getByRole("alert");
  const links = within(within(summary).getByRole("list")).getAllByRole("link");

  expect(links).toHaveLength(3);
});

test("rejects a password shorter than twelve characters", () => {
  render(<SignUpForm />);
  fill(/^Email address/, "student@uitm.edu.my");
  fill(/^Password/, "short");
  fill(/^Confirm password/, "short");
  submit();

  expect(document.getElementById("password-error")).toHaveTextContent(/at least 12 characters/i);
});

test("rejects a confirmation that does not match", () => {
  render(<SignUpForm />);
  fill(/^Email address/, "student@uitm.edu.my");
  fill(/^Password/, "a-long-enough-passphrase");
  fill(/^Confirm password/, "a-different-passphrase");
  submit();

  expect(document.getElementById("confirm-password-error")).toHaveTextContent(/does not match/i);
});

test("explains that verification is required and that it is not connected", () => {
  render(<SignUpForm />);
  fill(/^Email address/, "student@uitm.edu.my");
  fill(/^Password/, "a-long-enough-passphrase");
  fill(/^Confirm password/, "a-long-enough-passphrase");
  submit();

  expect(screen.getByRole("status")).toHaveTextContent(/not connected/i);
});

test("says that an account alone does not permit transacting", () => {
  render(<SignUpForm />);

  expect(screen.getByText(/institution verification/i)).toBeInTheDocument();
});
