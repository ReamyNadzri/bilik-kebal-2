import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FileUploadField } from "./file-upload-field";

describe("FileUploadField", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    // Mock crypto.subtle.digest
    const mockSubtle = {
      digest: vi.fn().mockResolvedValue(new Uint8Array(32).buffer),
    };
    vi.stubGlobal("crypto", { subtle: mockSubtle });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders idle empty state with file picker button", () => {
    render(<FileUploadField wantedId="74000000-0000-4000-8000-000000000001" />);

    expect(screen.getByText(/click to attach proof file/i)).toBeInTheDocument();
    expect(screen.getByTestId("proof-file-input")).toBeInTheDocument();
  });

  it("rejects unsupported MIME type on the client side", async () => {
    const onUploadError = vi.fn();
    render(
      <FileUploadField
        wantedId="74000000-0000-4000-8000-000000000001"
        onUploadError={onUploadError}
      />,
    );

    const input = screen.getByTestId("proof-file-input");
    const badFile = new File(["malicious"], "virus.exe", { type: "application/x-msdownload" });

    fireEvent.change(input, { target: { files: [badFile] } });

    expect(screen.getByText(/unsupported file type/i)).toBeInTheDocument();
    expect(onUploadError).toHaveBeenCalledWith(expect.stringContaining("Unsupported file type"));
  });

  it("rejects file exceeding max size", async () => {
    const onUploadError = vi.fn();
    render(
      <FileUploadField
        wantedId="74000000-0000-4000-8000-000000000001"
        maxSizeBytes={1024} // 1 KB max
        onUploadError={onUploadError}
      />,
    );

    const input = screen.getByTestId("proof-file-input");
    const largeFile = new File([new Uint8Array(2048)], "large.png", { type: "image/png" });

    fireEvent.change(input, { target: { files: [largeFile] } });

    expect(screen.getByText(/file too large/i)).toBeInTheDocument();
    expect(onUploadError).toHaveBeenCalledWith(expect.stringContaining("File too large"));
  });

  it("executes successful upload flow from upload-url to confirmation", async () => {
    const onUploadComplete = vi.fn();

    // Mock fetch for /api/claims/upload-url and /api/claims/confirm-upload
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/claims/upload-url")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              data: {
                claimId: "83000000-0000-4000-8000-000000000001",
                signedUrl: "https://storage.test/upload",
                token: "test-token",
              },
            }),
        });
      }
      if (url.includes("/api/claims/confirm-upload")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              ok: true,
              data: {
                claimId: "83000000-0000-4000-8000-000000000001",
                wantedId: "74000000-0000-4000-8000-000000000001",
                status: "screening",
                fileName: "proof_screenshot.png",
                sizeBytes: 500,
                mimeType: "image/png",
                completedAt: "2026-09-20T12:00:00Z",
              },
            }),
        });
      }
      return Promise.reject(new Error("Unknown URL"));
    });
    vi.stubGlobal("fetch", fetchMock);

    // Mock XMLHttpRequest
    class MockXMLHttpRequest {
      open = vi.fn();
      send = vi.fn(() => {
        setTimeout(() => {
          this.status = 200;
          this.loadCb?.();
        }, 10);
      });
      setRequestHeader = vi.fn();
      status = 200;
      loadCb?: () => void;
      upload = {
        addEventListener: vi.fn((event: string, cb: (e: unknown) => void) => {
          if (event === "progress") {
            cb({ lengthComputable: true, loaded: 500, total: 500 });
          }
        }),
      };
      addEventListener = vi.fn((event: string, cb: () => void) => {
        if (event === "load") {
          this.loadCb = cb;
        }
      });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.stubGlobal("XMLHttpRequest", MockXMLHttpRequest as any);

    render(
      <FileUploadField
        wantedId="74000000-0000-4000-8000-000000000001"
        onUploadComplete={onUploadComplete}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: /authorised to share/i }));
    const input = screen.getByTestId("proof-file-input");
    const validFile = new File([new Uint8Array(500)], "proof_screenshot.png", {
      type: "image/png",
    });

    fireEvent.change(input, { target: { files: [validFile] } });

    await waitFor(() => {
      expect(screen.getByText(/proof_screenshot\.png/i)).toBeInTheDocument();
      expect(screen.getByText(/uploaded and sent for screening/i)).toBeInTheDocument();
    });

    expect(onUploadComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        claimId: "83000000-0000-4000-8000-000000000001",
        status: "screening",
        fileName: "proof_screenshot.png",
      }),
    );
  });

  it("calls onRemoveProof and resets to idle when Cancel Upload is clicked after completion", async () => {
    const onRemoveProof = vi.fn();
    render(<FileUploadField wantedId="non-uuid-fixture" onRemoveProof={onRemoveProof} />);

    fireEvent.click(screen.getByRole("checkbox", { name: /authorised to share/i }));
    const input = screen.getByTestId("proof-file-input");
    const validFile = new File([new Uint8Array(200)], "my_notes.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [validFile] } });

    await waitFor(
      () => {
        expect(screen.getByText(/preview only: nothing was uploaded/i)).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    fireEvent.click(screen.getByRole("button", { name: /cancel upload/i }));

    expect(onRemoveProof).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: "my_notes.pdf",
      }),
    );
    expect(screen.getByText(/click to attach proof file/i)).toBeInTheDocument();
  });

  it("leaves the rights confirmation unticked and refuses an upload until it is ticked", async () => {
    render(<FileUploadField wantedId="74000000-0000-4000-8000-000000000001" />);

    const rights = screen.getByRole("checkbox", { name: /authorised to share/i });
    expect(rights).not.toBeChecked();

    fireEvent.change(screen.getByTestId("proof-file-input"), {
      target: { files: [new File([new Uint8Array(10)], "notes.pdf", { type: "application/pdf" })] },
    });

    expect(await screen.findByText(/confirm that you are authorised/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
