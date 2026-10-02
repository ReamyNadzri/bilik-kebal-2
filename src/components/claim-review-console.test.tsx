import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClaimReviewConsole } from "./claim-review-console";

const ITEM = {
  claimId: "00000000-0000-4000-8000-000000000001",
  wantedId: "00000000-0000-4000-8000-0000000000aa",
  institutionId: "00000000-0000-4000-8000-0000000000bb",
  status: "under_review",
  fileName: "notes.pdf",
  mimeType: "application/pdf",
  sizeBytes: 20480,
  createdAt: "2026-10-01T00:00:00.000Z",
  wantedPublicId: "w-123",
  wantedTitle: "CSC 301 past year",
};

function respond(body: unknown, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);
}

describe("ClaimReviewConsole", () => {
  const fetchMock = vi.fn();
  const prompt = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    prompt.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("prompt", prompt);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("lists claims and shows details with a link to the Wanted", async () => {
    fetchMock.mockReturnValueOnce(respond({ ok: true, data: [ITEM] }));
    render(<ClaimReviewConsole />);
    const list = await screen.findByRole("list", { name: /claim reviews waiting/ });
    expect(list).toHaveAttribute("tabindex", "0");
    fireEvent.click(screen.getByRole("button", { name: /notes\.pdf/ }));
    expect(screen.getByRole("heading", { name: "notes.pdf" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CSC 301 past year" })).toHaveAttribute(
      "href",
      "/wanted/w-123",
    );
  });

  it("records a decision with a chosen reason and no prompt", async () => {
    fetchMock
      .mockReturnValueOnce(respond({ ok: true, data: [ITEM] }))
      .mockReturnValueOnce(respond({ ok: true, data: { reviewId: "r1" } }));
    render(<ClaimReviewConsole />);
    fireEvent.click(await screen.findByRole("button", { name: /notes\.pdf/ }));
    fireEvent.click(screen.getByRole("radio", { name: "Reject" }));
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "wrong_file" } });
    fireEvent.click(screen.getByRole("button", { name: "Record decision" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("/api/claims/reviews");
    expect(JSON.parse(String(init.body))).toEqual({
      claimId: ITEM.claimId,
      decision: "reject",
      reasonCode: "wrong_file",
      notes: null,
    });
    expect(prompt).not.toHaveBeenCalled();
    expect(await screen.findByText("Decision recorded.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /notes\.pdf/ })).not.toBeInTheDocument();
    expect(screen.getByText("No claims are waiting for review")).toBeInTheDocument();
  });

  it("shows the server message when a decision fails", async () => {
    fetchMock
      .mockReturnValueOnce(respond({ ok: true, data: [ITEM] }))
      .mockReturnValueOnce(respond({ ok: false, message: "Not allowed." }, false));
    render(<ClaimReviewConsole />);
    fireEvent.click(await screen.findByRole("button", { name: /notes\.pdf/ }));
    fireEvent.click(screen.getByRole("button", { name: "Record decision" }));
    expect(await screen.findByText("Not allowed.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /notes\.pdf/ })).toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    fetchMock.mockReturnValueOnce(respond({ ok: true, data: [] }));
    render(<ClaimReviewConsole />);
    expect(await screen.findByText("No claims are waiting for review")).toBeInTheDocument();
  });

  it("shows an error with Try again", async () => {
    fetchMock.mockReturnValueOnce(respond({ ok: false, message: "Down." }, false));
    render(<ClaimReviewConsole />);
    expect(await screen.findByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.getByText("Down.")).toBeInTheDocument();
  });
});
