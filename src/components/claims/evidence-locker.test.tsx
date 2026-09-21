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
    expect(screen.getByText("Screening")).toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /download/i })).toHaveAttribute(
      "href",
      "https://example.com/download/ev-1",
    );
  });
});
