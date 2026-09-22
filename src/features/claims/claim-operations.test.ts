import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  computeFileSha256,
  requestClaimUploadSession,
  submitClaimFile,
  uploadFileToQuarantine,
  validateClaimFile,
} from "./claim-operations";
import type { ClaimUploadSession } from "@/contracts/claims";

describe("claim-operations", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("computeFileSha256", () => {
    it("computes a valid 64-character SHA-256 hex digest for file content", async () => {
      const file = new File(["hello world"], "test.pdf", { type: "application/pdf" });
      const digest = await computeFileSha256(file);

      // Known SHA-256 of "hello world"
      expect(digest).toBe("b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
      expect(digest).toHaveLength(64);
    });
  });

  describe("validateClaimFile", () => {
    it("accepts valid PDF files within 50 MB", () => {
      const file = new File(["content"], "notes.pdf", { type: "application/pdf" });
      const result = validateClaimFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("rejects files exceeding 50 MB", () => {
      const largeFile = new File([""], "huge.pdf", { type: "application/pdf" });
      Object.defineProperty(largeFile, "size", { value: 50 * 1024 * 1024 + 1 });

      const result = validateClaimFile(largeFile);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/exceeds 50 MB/i);
    });

    it("rejects unsupported MIME types", () => {
      const exeFile = new File(["content"], "virus.exe", { type: "application/x-msdownload" });
      const result = validateClaimFile(exeFile);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/unsupported file type/i);
    });

    it("rejects empty files (0 bytes)", () => {
      const emptyFile = new File([], "empty.pdf", { type: "application/pdf" });
      const result = validateClaimFile(emptyFile);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/cannot be empty/i);
    });
  });

  describe("requestClaimUploadSession", () => {
    it("calls POST /api/claims/upload-url and returns upload session", async () => {
      const mockSession: ClaimUploadSession = {
        claimId: "claim-1",
        objectPath: "quarantine/test.pdf",
        bucket: "quarantine",
        signedUrl: "https://storage.example.com/sign/upload",
        token: "upload-token",
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        maxBytes: 52428800,
        mimeType: "application/pdf",
      };

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, data: mockSession }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const input = {
        wantedId: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
        fileName: "notes.pdf",
        mimeType: "application/pdf" as const,
        sizeBytes: 1024,
        sha256: "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
        rightsConfirmed: true as const,
        freeReleaseOptIn: false,
      };

      const result = await requestClaimUploadSession(input);

      expect(global.fetch).toHaveBeenCalledWith("/api/claims/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      expect(result).toEqual({ ok: true, data: mockSession });
    });
  });

  describe("uploadFileToQuarantine", () => {
    it("issues PUT request directly to signed URL with file body", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(new Response(null, { status: 200 }));

      const file = new File(["binary-data"], "test.pdf", { type: "application/pdf" });
      const result = await uploadFileToQuarantine(
        "https://storage.example.com/quarantine/test.pdf",
        file,
        "application/pdf",
      );

      expect(global.fetch).toHaveBeenCalledWith("https://storage.example.com/quarantine/test.pdf", {
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        body: file,
      });

      expect(result.ok).toBe(true);
    });
  });

  describe("submitClaimFile", () => {
    it("orchestrates full submission: hash -> auth -> quarantine PUT -> complete", async () => {
      const mockSession: ClaimUploadSession = {
        claimId: "claim-abc",
        objectPath: "quarantine/claim-abc.pdf",
        bucket: "quarantine",
        signedUrl: "https://storage.example.com/upload",
        token: "tok-1",
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        maxBytes: 52428800,
        mimeType: "application/pdf",
      };

      // 1. Session creation response
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, data: mockSession }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      );

      // 2. Direct PUT to quarantine bucket
      vi.mocked(global.fetch).mockResolvedValueOnce(new Response(null, { status: 200 }));

      const steps: string[] = [];
      const file = new File(["content"], "notes.pdf", { type: "application/pdf" });

      const result = await submitClaimFile({
        wantedId: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
        file,
        rightsConfirmed: true,
        freeReleaseOptIn: true,
        onProgress: (step) => steps.push(step),
      });

      expect(steps).toEqual(["hashing", "authorizing", "uploading", "complete"]);
      expect(result).toEqual({ ok: true, data: { claimId: "claim-abc" } });
    });

    it("handles launch-gate refusal UPLOAD_UNAVAILABLE", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: false,
            code: "UPLOAD_UNAVAILABLE",
            message: "Public uploads are currently disabled.",
          }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

      const file = new File(["content"], "notes.pdf", { type: "application/pdf" });

      const result = await submitClaimFile({
        wantedId: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
        file,
        rightsConfirmed: true,
        freeReleaseOptIn: false,
      });

      expect(result).toEqual({
        ok: false,
        code: "UPLOAD_UNAVAILABLE",
        message: "Public uploads are currently disabled.",
      });
    });
  });
});
