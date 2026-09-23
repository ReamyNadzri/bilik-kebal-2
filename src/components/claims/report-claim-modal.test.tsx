import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReportClaimModal } from "./report-claim-modal";

describe("ReportClaimModal", () => {
  it("renders when open and displays high-risk warning on personal_data selection", () => {
    render(
      <ReportClaimModal
        claimId="74000000-0000-4000-8000-000000000001"
        claimTitle="CSC510 Final Exam Notes.pdf"
        isOpen={true}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("File: CSC510 Final Exam Notes.pdf")).toBeInTheDocument();

    const select = screen.getByLabelText(/issue category/i);
    fireEvent.change(select, { target: { value: "personal_data" } });

    expect(
      screen.getByText(/high-risk reports \(personal data, malware, fraud\) trigger an immediate/i),
    ).toBeInTheDocument();
  });

  it("calls onClose when Cancel button is clicked", () => {
    const handleClose = vi.fn();
    render(
      <ReportClaimModal
        claimId="74000000-0000-4000-8000-000000000001"
        isOpen={true}
        onClose={handleClose}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(handleClose).toHaveBeenCalled();
  });
});
