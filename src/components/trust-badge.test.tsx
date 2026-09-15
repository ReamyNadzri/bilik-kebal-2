import { render, screen } from "@testing-library/react";
import { TrustBadge } from "./trust-badge";

test("distinguishes email verification from institution verification", () => {
  const { rerender } = render(<TrustBadge kind="email" state="verified" />);
  expect(screen.getByText("Email Verified")).toBeInTheDocument();

  rerender(<TrustBadge kind="institution" state="verified" />);
  expect(screen.getByText("Institution Verified")).toBeInTheDocument();
  expect(screen.queryByText("Email Verified")).not.toBeInTheDocument();
});

test("shows the star emblem only for a verified institution", () => {
  const { rerender } = render(<TrustBadge kind="institution" state="verified" />);
  expect(screen.getByTestId("star-emblem")).toBeInTheDocument();

  rerender(<TrustBadge kind="institution" state="pending" />);
  expect(screen.queryByTestId("star-emblem")).not.toBeInTheDocument();

  rerender(<TrustBadge kind="email" state="verified" />);
  expect(screen.queryByTestId("star-emblem")).not.toBeInTheDocument();
});

test("gives the star emblem a text equivalent rather than an icon alone", () => {
  render(<TrustBadge kind="institution" state="verified" />);

  const emblem = screen.getByTestId("star-emblem");

  expect(emblem).toHaveAttribute("aria-hidden", "true");
  expect(screen.getByText("Institution Verified")).toBeInTheDocument();
});

test("explains that the emblem is not a quality guarantee", () => {
  render(<TrustBadge kind="institution" state="verified" />);

  expect(screen.getByText(/does not guarantee/i)).toHaveTextContent(
    /does not guarantee resource quality/i,
  );
});

test("labels every institution state in plain English", () => {
  const expected = {
    unverified: "Institution Not Verified",
    pending: "Institution Verification Pending",
    verified: "Institution Verified",
    rejected: "Institution Verification Rejected",
  } as const;

  for (const [state, label] of Object.entries(expected)) {
    const { unmount } = render(
      <TrustBadge kind="institution" state={state as keyof typeof expected} />,
    );
    expect(screen.getByText(label)).toBeInTheDocument();
    unmount();
  }
});

test("does not claim verification the account does not have", () => {
  render(<TrustBadge kind="email" state="unverified" />);

  expect(screen.getByText("Email Not Verified")).toBeInTheDocument();
  expect(screen.queryByText("Email Verified")).not.toBeInTheDocument();
});
