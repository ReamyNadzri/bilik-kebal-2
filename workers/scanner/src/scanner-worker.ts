export type ScannerJob = {
  claimId: string;
  bucket: "quarantine";
  objectKey: string;
  sha256: string;
  mimeType: string;
  sizeBytes: number;
};

export type ScannerOutcome = {
  status: "clean" | "blocked" | "needs_review" | "error";
  reasonCodes: string[];
};

export type ScannerEngine = {
  name: string;
  version: string;
  scan(file: { bytes: Uint8Array; mimeType: string }): Promise<ScannerOutcome>;
};

export type QuarantineReader = {
  read(objectKey: string): Promise<Uint8Array>;
};

export type ScreeningResultWriter = {
  recordResult(input: {
    claimId: string;
    status: ScannerOutcome["status"];
    scannerName: string;
    scannerVersion: string;
    reasonCodes: string[];
    completedAt: string;
  }): Promise<void>;
  acknowledgeJob(input: {
    claimId: string;
    state: "completed" | "failed";
    errorCode?: string;
  }): Promise<void>;
};

export async function runScannerJob(
  job: ScannerJob,
  dependencies: { reader: QuarantineReader; engine: ScannerEngine; writer: ScreeningResultWriter },
  now = () => new Date(),
): Promise<void> {
  try {
    const bytes = await dependencies.reader.read(job.objectKey);
    const outcome = await dependencies.engine.scan({ bytes, mimeType: job.mimeType });
    await dependencies.writer.recordResult({
      claimId: job.claimId,
      status: outcome.status,
      scannerName: dependencies.engine.name,
      scannerVersion: dependencies.engine.version,
      reasonCodes: outcome.reasonCodes,
      completedAt: now().toISOString(),
    });
    await dependencies.writer.acknowledgeJob({ claimId: job.claimId, state: "completed" });
  } catch {
    await dependencies.writer.acknowledgeJob({
      claimId: job.claimId,
      state: "failed",
      errorCode: "SCANNER_EXECUTION_FAILED",
    });
    throw new Error("Scanner job failed");
  }
}
