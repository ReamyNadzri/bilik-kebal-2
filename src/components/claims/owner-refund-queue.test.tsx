import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RefundTaskView } from "@/contracts/payouts";
import { OwnerRefundQueue } from "./owner-refund-queue";

describe("OwnerRefundQueue", () => {
  const mockTasks: RefundTaskView[] = [
    {
      id: "refund-1",
      wantedRequestId: "wanted-1",
      contributionId: "contrib-1",
      contributorUserId: "u-contrib-1",
      contributorDisplayName: "Farid Contributor",
      amountSen: 2000,
      status: "pending",
      externalReference: null,
      refundMethod: null,
      evidenceNotes: null,
      completedAt: null,
      ownerUserId: null,
      createdAt: "2026-09-24T10:00:00Z",
    },
    {
      id: "refund-2",
      wantedRequestId: "wanted-2",
      contributionId: "contrib-2",
      contributorUserId: "u-contrib-2",
      contributorDisplayName: "Zul Contributor",
      amountSen: 3000,
      status: "completed",
      externalReference: "REV-TOYYIB-001",
      refundMethod: "toyyibpay_reversal",
      evidenceNotes: "Done",
      completedAt: "2026-09-24T12:00:00Z",
      ownerUserId: "u-owner",
      createdAt: "2026-09-24T08:00:00Z",
    },
  ];

  it("renders empty state when no tasks exist", () => {
    render(<OwnerRefundQueue tasks={[]} />);
    expect(screen.getByTestId("refund-empty-state")).toBeInTheDocument();
  });

  it("renders task rows with correct money amount in RM", () => {
    render(<OwnerRefundQueue tasks={mockTasks} />);

    expect(screen.getByText("Farid Contributor")).toBeInTheDocument();
    expect(screen.getByText("RM 20.00")).toBeInTheDocument();

    expect(screen.getByText("Zul Contributor")).toBeInTheDocument();
    expect(screen.getByText("RM 30.00")).toBeInTheDocument();
    expect(screen.getByText("Ref: REV-TOYYIB-001")).toBeInTheDocument();

    expect(screen.getByTestId("refund-summary-badge")).toHaveTextContent("Pending: 1 (RM 20.00)");
  });

  it("opens modal and submits refund completion successfully", async () => {
    const onCompleteRefund = vi.fn().mockResolvedValue({ ok: true });
    render(<OwnerRefundQueue tasks={mockTasks} onCompleteRefund={onCompleteRefund} />);

    const refundBtn = screen.getByRole("button", {
      name: /process refund of rm 20\.00/i,
    });
    fireEvent.click(refundBtn);

    expect(screen.getByTestId("refund-completion-modal")).toBeInTheDocument();

    const refInput = screen.getByLabelText(/bank \/ gateway reference/i);
    fireEvent.change(refInput, { target: { value: "REV-TP-998811" } });

    const submitBtn = screen.getByRole("button", { name: /confirm refund recorded/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onCompleteRefund).toHaveBeenCalledWith("refund-1", {
        externalReference: "REV-TP-998811",
        refundMethod: "toyyibpay_reversal",
        evidenceNotes: undefined,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("refund-success-alert")).toHaveTextContent(
        /refund of rm 20\.00 recorded successfully/i,
      );
    });
  });

  it("displays validation error when reference is too short", async () => {
    render(<OwnerRefundQueue tasks={mockTasks} />);

    const refundBtn = screen.getByRole("button", {
      name: /process refund of rm 20\.00/i,
    });
    fireEvent.click(refundBtn);

    const refInput = screen.getByLabelText(/bank \/ gateway reference/i);
    fireEvent.change(refInput, { target: { value: "ab" } });

    const submitBtn = screen.getByRole("button", { name: /confirm refund recorded/i });
    fireEvent.click(submitBtn);

    expect(
      screen.getByText(/external reference must be at least 3 characters/i),
    ).toBeInTheDocument();
  });
});
