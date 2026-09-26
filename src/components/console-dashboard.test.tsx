import { render, screen } from "@testing-library/react";
import { ConsoleDashboard } from "./console-dashboard";

afterEach(() => vi.unstubAllGlobals());

const counts = { claims: 2, appeals: 1, payouts: 1, refunds: null };

test("shows each queue's server count and links to it", () => {
  render(<ConsoleDashboard verificationCount={3} counts={counts} />);

  const claims = screen.getByRole("link", { name: /Claims to review/ });
  expect(claims).toHaveTextContent("2");
  expect(claims).toHaveAttribute("href", "/console/claims");
  expect(screen.getByRole("link", { name: /Institution verifications/ })).toHaveTextContent("3");
  expect(screen.getByRole("link", { name: /Appeals/ })).toHaveTextContent("1");
  expect(screen.getByRole("link", { name: /Payouts to record/ })).toHaveTextContent("1");
  expect(screen.getByRole("link", { name: /Refunds to record/ })).toHaveTextContent(
    "Not available to your role",
  );
});

test("shows a real zero as zero, not as unavailable", () => {
  render(
    <ConsoleDashboard
      verificationCount={0}
      counts={{ claims: 0, appeals: 0, payouts: 0, refunds: 0 }}
    />,
  );

  const claims = screen.getByRole("link", { name: /Claims to review/ });
  expect(claims).toHaveTextContent("0");
  expect(claims).not.toHaveTextContent("Not available to your role");
});

test("arrives complete, sending no request of its own", () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);

  render(<ConsoleDashboard verificationCount={3} counts={counts} />);

  expect(fetch).not.toHaveBeenCalled();
  expect(screen.queryByText("…")).not.toBeInTheDocument();
});
