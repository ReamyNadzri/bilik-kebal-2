import { render, screen } from "@testing-library/react";
import { UiStatus, type UiStatusKind } from "./ui-status";

test("announces failure states assertively", () => {
  const { rerender } = render(<UiStatus kind="error" heading="Payment could not be confirmed" />);
  expect(screen.getByRole("alert")).toHaveTextContent("Payment could not be confirmed");

  rerender(<UiStatus kind="restricted" heading="Institution verification required" />);
  expect(screen.getByRole("alert")).toHaveTextContent("Institution verification required");
});

test("announces loading politely without blocking", () => {
  const { container } = render(<UiStatus kind="loading" heading="Loading the Wanted Board" />);
  const region = container.querySelector("[aria-live]");

  expect(region).toHaveAttribute("aria-live", "polite");
  expect(region).toHaveAttribute("aria-busy", "true");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("announces expired and offline states politely", () => {
  const { rerender } = render(<UiStatus kind="expired" heading="This bounty has expired" />);
  expect(screen.getByRole("status")).toHaveTextContent("This bounty has expired");

  rerender(<UiStatus kind="offline" heading="You are offline" />);
  expect(screen.getByRole("status")).toHaveTextContent("You are offline");
});

test("never relies on colour alone to convey the state", () => {
  const expected: Record<UiStatusKind, string> = {
    loading: "Loading",
    empty: "Empty",
    success: "Success",
    error: "Error",
    restricted: "Restricted",
    expired: "Expired",
    offline: "Offline",
  };

  for (const [kind, label] of Object.entries(expected)) {
    const { unmount } = render(<UiStatus kind={kind as UiStatusKind} heading="Heading" />);
    expect(screen.getByText(label)).toBeInTheDocument();
    unmount();
  }
});

test("renders heading, optional message and optional action", () => {
  const { rerender } = render(<UiStatus kind="empty" heading="No Wanted requests yet" />);

  expect(screen.getByRole("heading", { name: "No Wanted requests yet" })).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();

  rerender(
    <UiStatus
      kind="empty"
      heading="No Wanted requests yet"
      message="Create one to start a bounty."
      action={<button type="button">Create Wanted</button>}
    />,
  );

  expect(screen.getByText("Create one to start a bounty.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Create Wanted" })).toBeInTheDocument();
});
