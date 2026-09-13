import { fireEvent, render, screen } from "@testing-library/react";
import { RecoverForm } from "./recover-form";

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "Send recovery link" }));
}

test("asks only for the email address", () => {
  render(<RecoverForm />);

  expect(screen.getByLabelText(/Email address/)).toBeInTheDocument();
  expect(screen.queryByLabelText(/Password/)).not.toBeInTheDocument();
});

test("reports a missing email address and moves focus to the summary", () => {
  render(<RecoverForm />);
  submit();

  expect(document.getElementById("email-error")).toHaveTextContent("Enter your email address.");
  expect(screen.getByRole("alert")).toHaveFocus();
});

test("does not reveal whether an account exists", () => {
  render(<RecoverForm />);
  fireEvent.change(screen.getByLabelText(/Email address/), {
    target: { value: "student@uitm.edu.my" },
  });
  submit();

  const result = screen.getByRole("status");

  expect(result).toHaveTextContent(/if an account exists/i);
  expect(result).not.toHaveTextContent("student@uitm.edu.my");
});

test("says plainly that no email was sent", () => {
  render(<RecoverForm />);
  fireEvent.change(screen.getByLabelText(/Email address/), {
    target: { value: "student@uitm.edu.my" },
  });
  submit();

  expect(screen.getByRole("status")).toHaveTextContent(/not connected/i);
});
