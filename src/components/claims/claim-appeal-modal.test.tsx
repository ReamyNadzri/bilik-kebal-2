import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClaimAppealModal } from "./claim-appeal-modal";

describe("ClaimAppealModal", () => {
  it("renders appeal modal and displays 7-day policy notice", () => {
    render(
      <ClaimAppealModal
        claimId="74000000-0000-4000-8000-000000000001"
        claimTitle="Week 4 Tutorial.pdf"
        reviewDate="2026-09-20T10:00:00Z"
        isOpen={true}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Claim: Week 4 Tutorial.pdf")).toBeInTheDocument();
    expect(screen.getByText(/7-day appeal policy/i)).toBeInTheDocument();
    expect(screen.getByText(/different authorized sheriff/i)).toBeInTheDocument();
    expect(screen.getByText(/bounty countdowns and refunds are paused/i)).toBeInTheDocument();
  });

  it("validates that reason must be at least 10 characters before submitting", async () => {
    render(
      <ClaimAppealModal
        claimId="74000000-0000-4000-8000-000000000001"
        isOpen={true}
        onClose={vi.fn()}
      />,
    );

    const submitBtn = screen.getByRole("button", { name: /submit formal appeal/i });
    fireEvent.click(submitBtn);

    expect(
      screen.getByText(
        /please provide at least 10 characters explaining your appeal justification/i,
      ),
    ).toBeInTheDocument();
  });
});
