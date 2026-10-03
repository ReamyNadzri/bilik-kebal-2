import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClaimReviewFile } from "./claim-review-file";

const CLAIM = "00000000-0000-4000-8000-000000000001";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function signed(mimeType: string, url = "https://project.supabase.co/storage/v1/object/sign/q/k") {
  return Promise.resolve({
    ok: true,
    json: () =>
      Promise.resolve({
        ok: true,
        data: { url, expiresAt: "2026-10-03T02:05:00.000Z", mimeType },
      }),
  } as Response);
}

describe("ClaimReviewFile", () => {
  const fetchMock = vi.fn();
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

  beforeEach(() => {
    fetchMock.mockReset();
    click.mockClear();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("warns that the file is not scanned yet", () => {
    render(<ClaimReviewFile claimId={CLAIM} fileName="notes.pdf" mimeType="application/pdf" />);
    expect(screen.getByText(/not been virus-scanned/)).toBeInTheDocument();
    expect(screen.getByText(/never turn on editing or macros/)).toBeInTheDocument();
  });

  it("offers View and Download for a PDF", () => {
    render(<ClaimReviewFile claimId={CLAIM} fileName="notes.pdf" mimeType="application/pdf" />);
    expect(screen.getByRole("button", { name: "View notes.pdf" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download notes.pdf" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Show preview/ })).not.toBeInTheDocument();
  });

  it("offers only Download for an Office file", () => {
    render(<ClaimReviewFile claimId={CLAIM} fileName="notes.docx" mimeType={DOCX} />);
    expect(screen.getByRole("button", { name: "Download notes.docx" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /View/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Show preview/ })).not.toBeInTheDocument();
  });

  it("loads nothing until asked, then shows an image preview", async () => {
    fetchMock.mockReturnValueOnce(signed("image/png"));
    render(<ClaimReviewFile claimId={CLAIM} fileName="scan.png" mimeType="image/png" />);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show preview of scan.png" }));
    const image = await screen.findByRole("img", { name: "scan.png" });
    expect(image).toHaveAttribute("src", "https://project.supabase.co/storage/v1/object/sign/q/k");
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/claims/reviews/${CLAIM}/file?purpose=view`,
      expect.objectContaining({ cache: "no-store" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Hide preview" }));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("downloads through a fresh signed URL each time", async () => {
    fetchMock
      .mockReturnValueOnce(signed(DOCX, "https://project.supabase.co/one"))
      .mockReturnValueOnce(signed(DOCX, "https://project.supabase.co/two"));
    render(<ClaimReviewFile claimId={CLAIM} fileName="notes.docx" mimeType={DOCX} />);
    const button = screen.getByRole("button", { name: "Download notes.docx" });
    fireEvent.click(button);
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenLastCalledWith(
      `/api/claims/reviews/${CLAIM}/file?purpose=download`,
      expect.anything(),
    );
    fireEvent.click(button);
    await waitFor(() => expect(click).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("opens a PDF in a new tab it opened during the click", async () => {
    const tab = { opener: {}, location: { href: "" }, close: vi.fn() };
    const open = vi.fn(() => tab);
    vi.stubGlobal("open", open);
    fetchMock.mockReturnValueOnce(signed("application/pdf", "https://project.supabase.co/pdf"));
    render(<ClaimReviewFile claimId={CLAIM} fileName="notes.pdf" mimeType="application/pdf" />);
    fireEvent.click(screen.getByRole("button", { name: "View notes.pdf" }));
    expect(open).toHaveBeenCalledWith("", "_blank");
    await waitFor(() => expect(tab.location.href).toBe("https://project.supabase.co/pdf"));
    expect(tab.opener).toBeNull();
  });

  it("offers a link when the browser blocks the new tab", async () => {
    vi.stubGlobal(
      "open",
      vi.fn(() => null),
    );
    fetchMock.mockReturnValueOnce(signed("application/pdf", "https://project.supabase.co/pdf"));
    render(<ClaimReviewFile claimId={CLAIM} fileName="notes.pdf" mimeType="application/pdf" />);
    fireEvent.click(screen.getByRole("button", { name: "View notes.pdf" }));
    const link = await screen.findByRole("link", { name: /Open notes\.pdf/ });
    expect(link).toHaveAttribute("href", "https://project.supabase.co/pdf");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("says plainly when the file could not be opened, and closes the empty tab", async () => {
    const tab = { opener: {}, location: { href: "" }, close: vi.fn() };
    vi.stubGlobal(
      "open",
      vi.fn(() => tab),
    );
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    render(<ClaimReviewFile claimId={CLAIM} fileName="notes.pdf" mimeType="application/pdf" />);
    fireEvent.click(screen.getByRole("button", { name: "View notes.pdf" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The file could not be opened. Try again.",
    );
    expect(tab.close).toHaveBeenCalled();
  });

  it("shows the server's reason when access is refused", async () => {
    fetchMock.mockReturnValueOnce(
      Promise.resolve({
        ok: false,
        status: 403,
        json: () =>
          Promise.resolve({
            ok: false,
            code: "NOT_AUTHORIZED",
            message: "You cannot open files for this claim.",
          }),
      } as Response),
    );
    render(<ClaimReviewFile claimId={CLAIM} fileName="notes.docx" mimeType={DOCX} />);
    fireEvent.click(screen.getByRole("button", { name: "Download notes.docx" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You cannot open files for this claim.",
    );
    expect(click).not.toHaveBeenCalled();
  });
});
