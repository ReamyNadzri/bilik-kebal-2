import { fireEvent, render, screen } from "@testing-library/react";
import { EmailVerification } from "./email-verification";

const ADDRESS = "student@example.edu.my";

test("tells a waiting user where the link was sent", () => {
  render(<EmailVerification status="pending" address={ADDRESS} />);

  expect(screen.getByRole("status")).toHaveTextContent(ADDRESS);
  expect(screen.getByRole("button", { name: "Resend the link" })).toBeInTheDocument();
});

test("confirms success without overstating what it grants", () => {
  render(<EmailVerification status="verified" address={ADDRESS} />);

  expect(screen.getByText("Email Verified")).toBeInTheDocument();
  expect(screen.getByText(/institution verification/i)).toHaveTextContent(
    /funding a bounty, submitting a claim and downloading/i,
  );
});

test("does not claim institution verification after an email is verified", () => {
  render(<EmailVerification status="verified" address={ADDRESS} />);

  expect(screen.queryByText("Institution Verified")).not.toBeInTheDocument();
  expect(screen.queryByTestId("star-emblem")).not.toBeInTheDocument();
});

test("offers a new link when the old one expired", () => {
  render(<EmailVerification status="expired" address={ADDRESS} />);

  const notice = screen.getByRole("status");

  expect(notice).toHaveTextContent("Expired");
  expect(screen.getByRole("button", { name: "Resend the link" })).toBeInTheDocument();
});

test("announces an unusable link as a failure", () => {
  render(<EmailVerification status="invalid" address={ADDRESS} />);

  const alert = screen.getByRole("alert");

  expect(alert).toHaveTextContent("Error");
  expect(alert).toHaveTextContent(/could not be used/i);
});

test("reports that resending is not connected to an operation", () => {
  render(<EmailVerification status="pending" address={ADDRESS} />);

  fireEvent.click(screen.getByRole("button", { name: "Resend the link" }));

  expect(screen.getByRole("alert")).toHaveTextContent(/no email was sent/i);
});

test("does not offer a resend once the address is verified", () => {
  render(<EmailVerification status="verified" address={ADDRESS} />);

  expect(screen.queryByRole("button", { name: "Resend the link" })).not.toBeInTheDocument();
});
