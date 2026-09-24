import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ClaimSubmissionForm } from "./claim-submission-form";
import type { WantedDetail } from "@/features/marketplace/types";
import { toSen } from "@/features/marketplace/money";
import * as claimOps from "@/features/claims/claim-operations";

function createWantedDetail(): WantedDetail {
  return {
    id: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    title: "CSC510 Operating Systems Lecture Notes",
    courseCode: "CSC510",
    courseName: "Operating Systems",
    courseId: "course-123",
    grossBountySen: toSen(50),
    backerCount: 3,
    status: "open",
    postedAt: new Date(Date.now() - 86400000).toISOString(),
    closesAt: new Date(Date.now() + 86400000 * 13).toISOString(),
    resourceType: "Notes",
    resourceTypeId: "res-1",
    campus: "Shah Alam",
    campusId: "camp-1",
    session: "2026/2027-1",
    sessionId: "sess-1",
    feeRateBasisPoints: 1000,
    policyVersion: "2026-09-15.1",
    description: "Detailed notes needed for chapters 1-8.",
    faculty: "Computing",
    programme: "Computer Science",
    language: "English",
    tags: [],
    commissioner: { displayName: "Student A", emailVerified: true, institutionVerified: true },
    activity: [],
    similarIds: [],
  };
}

describe("ClaimSubmissionForm", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders upload dropzone, rights confirmation checkbox, and disabled submit button", () => {
    const wanted = createWantedDetail();
    render(<ClaimSubmissionForm wanted={wanted} onClose={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Submit a Claim" })).toBeInTheDocument();
    expect(screen.getByText(/Drag and drop your claim file here/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/I confirm I hold the rights/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit Claim" })).toBeDisabled();
  });

  it("handles valid file selection and enables submit when rights confirmed", async () => {
    const wanted = createWantedDetail();
    render(<ClaimSubmissionForm wanted={wanted} onClose={vi.fn()} />);

    const file = new File(["notes content"], "lecture-notes.pdf", { type: "application/pdf" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText("lecture-notes.pdf")).toBeInTheDocument();

    const rightsCheckbox = screen.getByLabelText(/I confirm I hold the rights/i);
    fireEvent.click(rightsCheckbox);

    expect(screen.getByRole("button", { name: "Submit Claim" })).toBeEnabled();
  });

  it("orchestrates successful claim submission and displays completion state", async () => {
    vi.spyOn(claimOps, "submitClaimFile").mockImplementation(async (opts) => {
      opts.onProgress?.("hashing");
      opts.onProgress?.("authorizing");
      opts.onProgress?.("uploading");
      opts.onProgress?.("complete");
      return { ok: true, data: { claimId: "claim-999" } };
    });

    const wanted = createWantedDetail();
    const onSubmitted = vi.fn();
    render(
      <ClaimSubmissionForm wanted={wanted} onClose={vi.fn()} onClaimSubmitted={onSubmitted} />,
    );

    const file = new File(["valid notes"], "notes.pdf", { type: "application/pdf" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByLabelText(/I confirm I hold the rights/i));

    fireEvent.click(screen.getByRole("button", { name: "Submit Claim" }));

    expect(await screen.findByText("Claim submitted for review")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View in Hunter.*Office/i })).toHaveAttribute(
      "href",
      "/claims",
    );
    expect(onSubmitted).toHaveBeenCalledWith("claim-999");
  });

  it("opens the file picker from the keyboard: the file input is labelled and focusable", () => {
    render(<ClaimSubmissionForm wanted={createWantedDetail()} onClose={vi.fn()} />);

    const input = screen.getByLabelText(/Drag and drop your claim file here/i);
    expect(input).toHaveAttribute("type", "file");
    expect(input).not.toHaveStyle({ display: "none" });
    input.focus();
    expect(input).toHaveFocus();
  });

  it("displays launch gate notice when uploads are disabled (UPLOAD_UNAVAILABLE)", async () => {
    vi.spyOn(claimOps, "submitClaimFile").mockResolvedValueOnce({
      ok: false,
      code: "UPLOAD_UNAVAILABLE",
      message: "Public uploads are currently disabled.",
    });

    const wanted = createWantedDetail();
    render(<ClaimSubmissionForm wanted={wanted} onClose={vi.fn()} />);

    const file = new File(["valid notes"], "notes.pdf", { type: "application/pdf" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByLabelText(/I confirm I hold the rights/i));

    fireEvent.click(screen.getByRole("button", { name: "Submit Claim" }));

    expect(await screen.findByText("Uploads are switched off")).toBeInTheDocument();
    expect(screen.getByText(/Claim uploads are not open yet/i)).toBeInTheDocument();
  });
});
