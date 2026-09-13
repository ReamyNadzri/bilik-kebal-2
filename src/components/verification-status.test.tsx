import { render, screen, within } from "@testing-library/react";
import type { InstitutionBadgeState } from "./trust-badge";
import { VerificationStatus } from "./verification-status";
import type { AccountCapabilities } from "@/features/presentation/account-capabilities";

const BROWSE_ONLY: AccountCapabilities = {
  browseMetadata: true,
  transact: false,
  submitClaim: false,
  download: false,
};

const FULL_ACCESS: AccountCapabilities = {
  browseMetadata: true,
  transact: true,
  submitClaim: true,
  download: true,
};

test("shows both trust states as separate badges", () => {
  render(
    <VerificationStatus email="verified" institution="unverified" capabilities={BROWSE_ONLY} />,
  );

  expect(screen.getByText("Email Verified")).toBeInTheDocument();
  expect(screen.getByText("Institution Not Verified")).toBeInTheDocument();
});

test("labels every institution state", () => {
  const expected: Record<InstitutionBadgeState, string> = {
    unverified: "Institution Not Verified",
    pending: "Institution Verification Pending",
    verified: "Institution Verified",
    rejected: "Institution Verification Rejected",
  };

  for (const [state, label] of Object.entries(expected)) {
    const capabilities = state === "verified" ? FULL_ACCESS : BROWSE_ONLY;
    const { unmount } = render(
      <VerificationStatus
        email="verified"
        institution={state as InstitutionBadgeState}
        capabilities={capabilities}
      />,
    );

    expect(screen.getByText(label)).toBeInTheDocument();
    unmount();
  }
});

test("announces the restriction when transacting is blocked", () => {
  render(
    <VerificationStatus email="verified" institution="unverified" capabilities={BROWSE_ONLY} />,
  );

  const alert = screen.getByRole("alert");

  expect(alert).toHaveTextContent("Restricted");
  expect(alert).toHaveTextContent(/institution verification/i);
});

test("says plainly that browsing is allowed while transacting is not", () => {
  render(<VerificationStatus email="verified" institution="pending" capabilities={BROWSE_ONLY} />);

  const capabilities = screen.getByRole("list", { name: "Account capabilities" });

  expect(within(capabilities).getByText("Browse Wanted metadata")).toBeInTheDocument();
  expect(within(capabilities).getAllByText("Allowed")).toHaveLength(1);
  expect(within(capabilities).getAllByText("Not allowed")).toHaveLength(3);
});

test("states each capability in text, never by colour alone", () => {
  render(
    <VerificationStatus email="verified" institution="unverified" capabilities={BROWSE_ONLY} />,
  );

  const capabilities = screen.getByRole("list", { name: "Account capabilities" });

  for (const label of [
    "Browse Wanted metadata",
    "Fund or create a bounty",
    "Submit a claim",
    "Download an entitled resource",
  ]) {
    expect(within(capabilities).getByText(label)).toBeInTheDocument();
  }
});

test("drops the restriction notice once every capability is granted", () => {
  render(<VerificationStatus email="verified" institution="verified" capabilities={FULL_ACCESS} />);

  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByRole("list", { name: "Account capabilities" })).toBeInTheDocument();
});

test("keeps a single heading hierarchy under the page title", () => {
  render(
    <VerificationStatus email="verified" institution="unverified" capabilities={BROWSE_ONLY} />,
  );

  const headings = screen.getAllByRole("heading");

  for (const heading of headings) {
    expect(Number(heading.tagName.replace("H", ""))).toBeGreaterThanOrEqual(2);
  }
});

test("exposes the verification action to the keyboard", () => {
  render(
    <VerificationStatus email="verified" institution="unverified" capabilities={BROWSE_ONLY} />,
  );

  const action = screen.getByRole("link", { name: "Verify your institution" });

  expect(action).toHaveAttribute("href", "/profile/institution-verification");
  expect(action).not.toHaveAttribute("tabindex", "-1");
});
