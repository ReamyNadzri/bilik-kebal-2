import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EvidenceLocker, type EvidenceItem } from "./evidence-locker";

describe("EvidenceLocker", () => {
  it("renders empty state by default when no evidence is provided", () => {
    render(<EvidenceLocker evidence={[]} />);
    expect(screen.getByText(/no evidence files yet/i)).toBeInTheDocument();
    expect(screen.getByTestId("evidence-empty-state")).toBeInTheDocument();
  });

  it("renders skeleton cards during loading state", () => {
    render(<EvidenceLocker isLoading={true} />);
    expect(screen.getByTestId("evidence-loading-skeletons")).toBeInTheDocument();
    expect(screen.queryByTestId("evidence-empty-state")).not.toBeInTheDocument();
  });

  it("renders error state and triggers retry callback", async () => {
    const onRetry = vi.fn();
    render(<EvidenceLocker error="Network disconnected" onRetry={onRetry} />);

    expect(screen.getByTestId("evidence-error-state")).toBeInTheDocument();
    expect(screen.getByText(/network disconnected/i)).toBeInTheDocument();

    const retryButton = screen.getByRole("button", { name: /retry/i });
    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders evidence cards with action type, status, and download links", () => {
    const mockEvidence: EvidenceItem[] = [
      {
        id: "ev-1",
        actionType: "Claim Proof",
        fileName: "exam_notes.pdf",
        mimeType: "application/pdf",
        sizeBytes: 2048576,
        uploadedAt: "2026-09-20T10:30:00Z",
        status: "screening",
        downloadUrl: "https://example.com/download/ev-1",
      },
      {
        id: "ev-2",
        actionType: "Arrived On Scene",
        fileName: "screenshot.png",
        mimeType: "image/png",
        sizeBytes: 102400,
        uploadedAt: "2026-09-20T11:00:00Z",
        status: "approved",
      },
    ];

    render(<EvidenceLocker evidence={mockEvidence} />);

    expect(screen.getByTestId("evidence-grid")).toBeInTheDocument();
    expect(screen.getByText("exam_notes.pdf")).toBeInTheDocument();
    expect(screen.getByText("screenshot.png")).toBeInTheDocument();
    expect(screen.getByTestId("badge-ev-1")).toHaveTextContent("Screening");
    expect(screen.getByTestId("badge-ev-2")).toHaveTextContent("Approved");
    expect(screen.getByRole("link", { name: /download/i })).toHaveAttribute(
      "href",
      "https://example.com/download/ev-1",
    );
  });

  it("renders dispatch alert banner and pipeline micro-stepper for active proofs", () => {
    const mockEvidence: EvidenceItem[] = [
      {
        id: "ev-1",
        actionType: "Claim Proof",
        fileName: "solutions.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1048576,
        uploadedAt: "2026-09-21T10:00:00Z",
        status: "under_review",
        reviewerNote: "Currently under Sheriff validation.",
      },
    ];

    render(<EvidenceLocker evidence={mockEvidence} />);

    // Dispatch banner rendered
    expect(screen.getByTestId("dispatch-alert-under_review")).toBeInTheDocument();
    expect(screen.getByText(/dispatched to sheriff review queue/i)).toBeInTheDocument();

    // Pipeline progress rendered
    expect(screen.getByTestId("pipeline-ev-1")).toBeInTheDocument();

    // Reviewer note rendered
    expect(screen.getByTestId("reviewer-note-ev-1")).toHaveTextContent(
      "Currently under Sheriff validation.",
    );
  });

  it("renders not_selected status distinctly", () => {
    const mockEvidence: EvidenceItem[] = [
      {
        id: "ev-ns",
        actionType: "Claim Proof",
        fileName: "notes.pdf",
        mimeType: "application/pdf",
        sizeBytes: 500000,
        uploadedAt: "2026-09-21T12:00:00Z",
        status: "not_selected",
      },
    ];

    render(<EvidenceLocker evidence={mockEvidence} />);

    expect(screen.getByTestId("badge-ev-ns")).toHaveTextContent("Not Selected");
    expect(screen.getByTestId("dispatch-alert-not_selected")).toBeInTheDocument();
  });
});
