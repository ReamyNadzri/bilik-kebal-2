import { describe, expect, it, vi } from "vitest";
import { runScannerJob, type ScannerJob } from "../../../../workers/scanner/src/scanner-worker";

const job: ScannerJob = {
  claimId: "00000000-0000-4000-8000-000000000001",
  bucket: "quarantine",
  objectKey: "user/claim/original",
  sha256: "a".repeat(64),
  mimeType: "application/pdf",
  sizeBytes: 12,
};

describe("scanner worker adapter", () => {
  it("reads quarantine bytes and records an identifier-only result", async () => {
    const writer = { acknowledgeJob: vi.fn(), recordResult: vi.fn().mockResolvedValue(undefined) };
    await runScannerJob(
      job,
      {
        reader: { read: vi.fn().mockResolvedValue(new Uint8Array([1, 2])) },
        engine: {
          name: "fixture",
          version: "1",
          scan: vi.fn().mockResolvedValue({ status: "clean", reasonCodes: [] }),
        },
        writer,
      },
      () => new Date("2026-09-20T02:00:00.000Z"),
    );
    expect(writer.recordResult).toHaveBeenCalledWith(
      expect.objectContaining({ claimId: job.claimId, status: "clean" }),
    );
    expect(writer.acknowledgeJob).toHaveBeenCalledWith({
      claimId: job.claimId,
      state: "completed",
    });
  });

  it("acknowledges failures and surfaces scanner errors", async () => {
    const writer = { acknowledgeJob: vi.fn(), recordResult: vi.fn() };
    await expect(
      runScannerJob(job, {
        reader: { read: vi.fn().mockRejectedValue(new Error("missing object")) },
        engine: { name: "fixture", version: "1", scan: vi.fn() },
        writer,
      }),
    ).rejects.toThrow("Scanner job failed");
    expect(writer.acknowledgeJob).toHaveBeenCalledWith({
      claimId: job.claimId,
      state: "failed",
      errorCode: "SCANNER_EXECUTION_FAILED",
    });
  });
});
