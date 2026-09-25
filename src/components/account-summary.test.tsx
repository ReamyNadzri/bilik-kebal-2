import { render, screen, within } from "@testing-library/react";
import { AccountSummary } from "./account-summary";
import { vi } from "vitest";
import { anAccountViewModel } from "@/features/presentation/test-support/account-view-model";

// Sign-out runs through the auth provider and has its own tests; the summary
// only has to place the control.
vi.mock("./sign-out-button", () => ({
  SignOutButton: () => <button type="button">Sign out</button>,
}));

test("names the signed-in account", () => {
  render(<AccountSummary account={anAccountViewModel({ displayName: "Aisyah Rahman" })} />);

  expect(screen.getByText("Aisyah Rahman")).toBeInTheDocument();
});

test("names the institution once one is confirmed", () => {
  render(
    <AccountSummary
      account={anAccountViewModel({
        trust: { email: "verified", institution: "verified", restricted: false },
        institution: { id: "11111111-1111-4111-8111-111111111111", name: "UiTM Shah Alam" },
        capabilities: {
          browseMetadata: true,
          transact: true,
          submitClaim: true,
          download: true,
        },
      })}
    />,
  );

  expect(screen.getByText("UiTM Shah Alam")).toBeInTheDocument();
});

test("says no institution is confirmed rather than showing an empty field", () => {
  render(<AccountSummary account={anAccountViewModel({ institution: null })} />);

  expect(screen.getByText("No institution confirmed")).toBeInTheDocument();
});

/**
 * The capability list must be a rendering of the backend decision, never a
 * recomputation from the trust states. These two tests pin that by feeding
 * combinations the frontend could not derive: if any component re-derived
 * permissions from `trust`, it would contradict `capabilities` and fail.
 */
test("renders granted capabilities even when the trust states alone would not imply them", () => {
  render(
    <AccountSummary
      account={anAccountViewModel({
        trust: { email: "verified", institution: "unverified", restricted: false },
        capabilities: {
          browseMetadata: true,
          transact: true,
          submitClaim: true,
          download: true,
        },
      })}
    />,
  );

  const capabilities = screen.getByRole("list", { name: "Account capabilities" });

  expect(within(capabilities).getAllByText("Allowed", { exact: true })).toHaveLength(4);
});

test("renders blocked capabilities even when the institution is verified", () => {
  render(
    <AccountSummary
      account={anAccountViewModel({
        trust: { email: "verified", institution: "verified", restricted: true },
        institution: { id: "11111111-1111-4111-8111-111111111111", name: "UiTM Shah Alam" },
        capabilities: {
          browseMetadata: true,
          transact: false,
          submitClaim: false,
          download: false,
        },
      })}
    />,
  );

  const capabilities = screen.getByRole("list", { name: "Account capabilities" });

  expect(within(capabilities).getAllByText("Not allowed", { exact: true })).toHaveLength(3);
});

/**
 * Restriction is a third trust axis, independent of the two verification
 * states. A restricted account whose institution is already verified must not
 * be told to verify its institution: that advice is both wrong and impossible
 * to act on.
 */
test("explains a restriction rather than telling a verified account to verify again", () => {
  render(
    <AccountSummary
      account={anAccountViewModel({
        trust: { email: "verified", institution: "verified", restricted: true },
        institution: { id: "11111111-1111-4111-8111-111111111111", name: "UiTM Shah Alam" },
        capabilities: {
          browseMetadata: true,
          transact: false,
          submitClaim: false,
          download: false,
        },
      })}
    />,
  );

  const alert = screen.getByRole("alert");

  expect(alert).toHaveTextContent(/restricted/i);
  expect(screen.queryByRole("link", { name: "Verify your institution" })).not.toBeInTheDocument();
});

test("still offers verification to an unrestricted account that has not verified", () => {
  render(<AccountSummary account={anAccountViewModel()} />);

  expect(screen.getByRole("link", { name: "Verify your institution" })).toHaveAttribute(
    "href",
    "/profile/institution-verification",
  );
});

/**
 * ErrorSummary and UiStatus both use role="alert". Two alerts entering the
 * accessibility tree in one update queue two interrupting announcements and
 * the second usually clips the first.
 */
test("never renders more than one alert, even when restricted and unverified at once", () => {
  render(
    <AccountSummary
      account={anAccountViewModel({
        trust: { email: "unverified", institution: "unverified", restricted: true },
        capabilities: {
          browseMetadata: false,
          transact: false,
          submitClaim: false,
          download: false,
        },
      })}
    />,
  );

  expect(screen.getAllByRole("alert")).toHaveLength(1);
});

test("keeps every heading below the page title", () => {
  render(<AccountSummary account={anAccountViewModel()} />);

  for (const heading of screen.getAllByRole("heading")) {
    expect(Number(heading.tagName.replace("H", ""))).toBeGreaterThanOrEqual(2);
  }
});

test("reports a verification request that is awaiting review", () => {
  render(
    <AccountSummary
      account={anAccountViewModel({
        trust: { email: "verified", institution: "pending", restricted: false },
        latestVerificationRequest: {
          requestId: "req-1",
          state: "pending",
          submittedAt: "2026-09-10T08:00:00.000Z",
          decidedAt: null,
          reasonCode: null,
          evidenceDeleteAfter: "2026-10-10T08:00:00.000Z",
        },
      })}
    />,
  );

  expect(screen.getByText(/awaiting review/i)).toBeInTheDocument();
  expect(screen.getByText(/10 September 2026/)).toBeInTheDocument();
});

test("gives the decision reason when a request was rejected", () => {
  render(
    <AccountSummary
      account={anAccountViewModel({
        trust: { email: "verified", institution: "rejected", restricted: false },
        latestVerificationRequest: {
          requestId: "req-2",
          state: "rejected",
          submittedAt: "2026-09-10T08:00:00.000Z",
          decidedAt: "2026-09-12T08:00:00.000Z",
          reasonCode: "evidence_unreadable",
          evidenceDeleteAfter: "2026-10-12T08:00:00.000Z",
        },
      })}
    />,
  );

  expect(screen.getByText(/evidence unreadable/i)).toBeInTheDocument();
});

test("says nothing about requests when none has been made", () => {
  render(<AccountSummary account={anAccountViewModel({ latestVerificationRequest: null })} />);

  expect(screen.queryByText(/awaiting review/i)).not.toBeInTheDocument();
});

test("offers the console only when the backend grants it", () => {
  render(<AccountSummary account={anAccountViewModel({ console: { hasAccess: true } })} />);

  expect(screen.getByRole("link", { name: "Open the Sheriff Console" })).toHaveAttribute(
    "href",
    "/console",
  );
});

test("hides the console entry when the backend withholds it", () => {
  render(<AccountSummary account={anAccountViewModel({ console: { hasAccess: false } })} />);

  expect(screen.queryByRole("link", { name: "Open the Sheriff Console" })).not.toBeInTheDocument();
});
