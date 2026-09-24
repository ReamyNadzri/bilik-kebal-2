import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { BackWantedModal } from "./back-wanted-modal";
import type { WantedDetail } from "@/features/marketplace/types";
import { toSen } from "@/features/marketplace/money";

function createWantedDetail(overrides: Partial<WantedDetail> = {}): WantedDetail {
  return {
    id: "wanted-123",
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
    ...overrides,
  };
}

describe("BackWantedModal", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("renders preset contribution choices (RM1, RM5, RM10, RM20, RM50)", () => {
    const wanted = createWantedDetail();
    render(<BackWantedModal wanted={wanted} onClose={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Back this Wanted" })).toBeInTheDocument();
    const fieldset = screen.getByRole("group", { name: "Select contribution amount" });
    expect(within(fieldset).getByText("RM 1")).toBeInTheDocument();
    expect(within(fieldset).getByText("RM 5")).toBeInTheDocument();
    expect(within(fieldset).getByText("RM 10")).toBeInTheDocument();
    expect(within(fieldset).getByText("RM 20")).toBeInTheDocument();
    expect(within(fieldset).getByText("RM 50")).toBeInTheDocument();
  });

  it("calculates projected bounty correctly when preset amount changes", () => {
    const wanted = createWantedDetail({ grossBountySen: toSen(50) });
    render(<BackWantedModal wanted={wanted} onClose={vi.fn()} />);

    // Default selection is RM 5 (500 sen) -> New total RM 55
    expect(screen.getByText("RM 55")).toBeInTheDocument();

    // Select RM 20
    const rm20Radio = screen.getByDisplayValue("2000");
    fireEvent.click(rm20Radio);

    // New total should be RM 70
    expect(screen.getByText("RM 70")).toBeInTheDocument();
  });

  it("calls onClose when Close button, Cancel button, or Escape is pressed", () => {
    const onClose = vi.fn();
    const wanted = createWantedDetail();
    render(<BackWantedModal wanted={wanted} onClose={onClose} />);

    // Close button
    fireEvent.click(screen.getByLabelText("Close dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);

    // Cancel button
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(2);

    // Escape key
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("handles launch-gate refusal with informative notice", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, code: "PAYMENT_DISABLED" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const wanted = createWantedDetail();
    render(<BackWantedModal wanted={wanted} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Proceed to payment/ }));

    expect(await screen.findByText("Online payment is not open yet")).toBeInTheDocument();
    expect(screen.getByText(/No charge was made and the bounty is unchanged/i)).toBeInTheDocument();
  });

  it("treats a missing contribution endpoint as payment not open, not as a charge", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response("<html>Not found</html>", { status: 404 }),
    );

    render(<BackWantedModal wanted={createWantedDetail()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Proceed to payment/ }));

    expect(await screen.findByText("Online payment is not open yet")).toBeInTheDocument();
  });

  it("sends a Backer who needs institution verification to verify, and says nothing was charged", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ ok: false, code: "INSTITUTION_VERIFICATION_REQUIRED", message: "" }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      ),
    );

    render(<BackWantedModal wanted={createWantedDetail()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Proceed to payment/ }));

    expect(await screen.findByText("Institution verification is needed")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Verify your institution" })).toHaveAttribute(
      "href",
      "/profile/institution-verification",
    );
    expect(screen.getByText(/No charge was made/)).toBeInTheDocument();
  });

  it("sends the chosen amount in integer sen", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, code: "PAYMENT_DISABLED", message: "" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<BackWantedModal wanted={createWantedDetail()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByDisplayValue("2000"));
    fireEvent.click(screen.getByRole("button", { name: /Proceed to payment/ }));

    await screen.findByText("Online payment is not open yet");
    const [, init] = vi.mocked(global.fetch).mock.calls[0]!;
    expect(JSON.parse(String(init?.body))).toEqual({ amountSen: 2000 });
  });
});
