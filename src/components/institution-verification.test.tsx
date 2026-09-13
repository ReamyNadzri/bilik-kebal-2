import { fireEvent, render, screen } from "@testing-library/react";
import { InstitutionVerification } from "./institution-verification";

test("offers the automatic route and the evidence route when unverified", () => {
  render(<InstitutionVerification state="unverified" approvedDomains={["example.edu.my"]} />);

  expect(screen.getByText(/example\.edu\.my/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Request verification" })).toBeInTheDocument();
});

test("does not present an unconfirmed domain list as fact", () => {
  render(<InstitutionVerification state="unverified" approvedDomains={[]} />);

  expect(screen.getByText(/has not been published yet/i)).toBeInTheDocument();
});

test("shows review in progress and withdraws the form while pending", () => {
  render(<InstitutionVerification state="pending" approvedDomains={[]} />);

  expect(screen.getByText("Institution Verification Pending")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Request verification" })).not.toBeInTheDocument();
});

test("asks for nothing further once verified", () => {
  render(<InstitutionVerification state="verified" approvedDomains={[]} />);

  expect(screen.getByText("Institution Verified")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Request verification" })).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/Evidence/)).not.toBeInTheDocument();
});

test("gives the reason and allows another attempt after rejection", () => {
  render(
    <InstitutionVerification
      state="rejected"
      approvedDomains={[]}
      rejectionReason="The document did not show your name."
    />,
  );

  expect(screen.getByText("The document did not show your name.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Request verification" })).toBeInTheDocument();
});

test("states who sees the evidence and how long it is kept", () => {
  render(<InstitutionVerification state="unverified" approvedDomains={[]} />);

  const privacy = screen.getByRole("note", { name: "How your evidence is handled" });

  expect(privacy).toHaveTextContent(/Sheriff/);
  expect(privacy).toHaveTextContent(/30 days/);
  expect(privacy).toHaveTextContent(/private/i);
});

test("requires the accuracy declaration before submitting", () => {
  render(<InstitutionVerification state="unverified" approvedDomains={[]} />);

  fireEvent.click(screen.getByRole("button", { name: "Request verification" }));

  expect(document.getElementById("declaration-error")).toHaveTextContent(/confirm/i);
});

test("requires an evidence file before submitting", () => {
  render(<InstitutionVerification state="unverified" approvedDomains={[]} />);

  fireEvent.click(screen.getByRole("button", { name: "Request verification" }));

  expect(document.getElementById("evidence-error")).toHaveTextContent(/choose a file/i);
});

test("reports that nothing was uploaded because no operation is connected", () => {
  render(<InstitutionVerification state="unverified" approvedDomains={[]} />);

  const file = new File(["id-card"], "student-card.png", { type: "image/png" });
  const input = screen.getByLabelText(/Evidence/);

  // jsdom does not populate FormData from a files array assigned via
  // fireEvent, so define a real FileList-like on the element instead.
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  fireEvent.change(input);
  fireEvent.click(screen.getByLabelText(/I confirm/));
  fireEvent.click(screen.getByRole("button", { name: "Request verification" }));

  expect(screen.getByRole("status")).toHaveTextContent(/not connected/i);
  expect(screen.getByRole("status")).toHaveTextContent(/nothing was uploaded/i);
});

test("offers only the evidence types the upload operation accepts", () => {
  render(<InstitutionVerification state="unverified" approvedDomains={[]} />);

  const input = screen.getByLabelText(/Evidence/);

  // The evidence allowlist is PDF, JPEG and PNG — narrower than the
  // claim-upload allowlist, which also permits WEBP and Office formats.
  expect(input).toHaveAttribute("accept", ".pdf,.jpg,.jpeg,.png");
  expect(screen.getByText(/PDF, JPEG or PNG/)).toBeInTheDocument();
  expect(screen.queryByText(/WEBP/i)).not.toBeInTheDocument();
});
