import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PayoutTaskView } from "@/contracts/payouts";
import { OwnerPayoutQueue } from "./owner-payout-queue";

describe("OwnerPayoutQueue", () => {
  const mockTasks: PayoutTaskView[] = [
    {
      id: "task-1",
      wantedRequestId: "wanted-1",
      claimId: "claim-1",
      hunterUserId: "u-hunter-1",
      hunterDisplayName: "Ahmad Albab",
      grossBountySen: 5000,
      feeRateBasisPoints: 1000,
      platformFeeSen: 500,
      netPayoutSen: 4500,
      status: "pending",
      externalReference: null,
      payoutMethod: null,
      evidenceNotes: null,
      completedAt: null,
      ownerUserId: null,
      createdAt: "2026-09-24T10:00:00Z",
    },
    {
      id: "task-2",
      wantedRequestId: "wanted-2",
      claimId: "claim-2",
      hunterUserId: "u-hunter-2",
      hunterDisplayName: "Siti Hunter",
      grossBountySen: 10000,
      feeRateBasisPoints: 1000,
      platformFeeSen: 1000,
      netPayoutSen: 9000,
      status: "completed",
      externalReference: "DUITNOW-PAID-001",
      payoutMethod: "duitnow",
      evidenceNotes: "Done",
      completedAt: "2026-09-24T12:00:00Z",
      ownerUserId: "u-owner",
      createdAt: "2026-09-24T08:00:00Z",
    },
  ];

  it("renders empty state when no tasks exist", () => {
    render(<OwnerPayoutQueue tasks={[]} />);
    expect(screen.getByTestId("payout-empty-state")).toBeInTheDocument();
  });

  it("renders task rows with correct money calculations in RM", () => {
    render(<OwnerPayoutQueue tasks={mockTasks} />);

    expect(screen.getByText("Ahmad Albab")).toBeInTheDocument();
    expect(screen.getByText("RM 50.00")).toBeInTheDocument();
    expect(screen.getByText("- RM 5.00")).toBeInTheDocument();
    expect(screen.getByText("RM 45.00")).toBeInTheDocument();

    expect(screen.getByText("Siti Hunter")).toBeInTheDocument();
    expect(screen.getByText("Ref: DUITNOW-PAID-001")).toBeInTheDocument();

    expect(screen.getByTestId("payout-summary-badge")).toHaveTextContent("Pending: 1 (RM 45.00)");
  });

  it("opens modal and submits payout completion successfully", async () => {
    const onCompletePayout = vi.fn().mockResolvedValue({ ok: true });
    render(<OwnerPayoutQueue tasks={mockTasks} onCompletePayout={onCompletePayout} />);

    const disburseBtn = screen.getByRole("button", {
      name: /complete payout for rm 45\.00/i,
    });
    fireEvent.click(disburseBtn);

    expect(screen.getByTestId("payout-completion-modal")).toBeInTheDocument();

    const refInput = screen.getByLabelText(/bank \/ gateway reference/i);
    fireEvent.change(refInput, { target: { value: "DUITNOW-20260925-9988" } });

    const submitBtn = screen.getByRole("button", { name: /confirm payout completion/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onCompletePayout).toHaveBeenCalledWith("task-1", {
        externalReference: "DUITNOW-20260925-9988",
        payoutMethod: "duitnow",
        evidenceNotes: undefined,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("payout-success-alert")).toHaveTextContent(
        /payout recorded successfully for rm 45\.00/i,
      );
    });
  });

  it("displays validation error when reference is too short", async () => {
    render(<OwnerPayoutQueue tasks={mockTasks} />);

    const disburseBtn = screen.getByRole("button", {
      name: /complete payout for rm 45\.00/i,
    });
    fireEvent.click(disburseBtn);

    const refInput = screen.getByLabelText(/bank \/ gateway reference/i);
    fireEvent.change(refInput, { target: { value: "ab" } });

    const submitBtn = screen.getByRole("button", { name: /confirm payout completion/i });
    fireEvent.click(submitBtn);

    expect(
      screen.getByText(/external reference must be at least 3 characters/i),
    ).toBeInTheDocument();
  });
});
