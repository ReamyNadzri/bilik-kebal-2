import { describe, expect, it } from "vitest";
import { claimScreeningJobSchema, claimScreeningResultSchema } from "./claim-screening";

describe("claim screening contracts", () => {
  it("accepts identifier-only quarantine jobs", () => {
    expect(
      claimScreeningJobSchema.safeParse({
        claimId: "00000000-0000-4000-8000-000000000001",
        bucket: "quarantine",
        objectKey: "user/claim/original",
        sha256: "a".repeat(64),
        mimeType: "application/pdf",
        sizeBytes: 1024,
      }).success,
    ).toBe(true);
  });

  it("rejects a job carrying file bytes", () => {
    expect(
      claimScreeningJobSchema.safeParse({
        claimId: "00000000-0000-4000-8000-000000000001",
        bucket: "quarantine",
        objectKey: "user/claim/original",
        sha256: "a".repeat(64),
        mimeType: "application/pdf",
        sizeBytes: 1024,
        content: "secret",
      }).success,
    ).toBe(false);
  });

  it("requires a human review reason trail for scanner results", () => {
    expect(
      claimScreeningResultSchema.safeParse({
        claimId: "00000000-0000-4000-8000-000000000001",
        status: "blocked",
        scannerName: "fixture-scanner",
        scannerVersion: "1.0.0",
        reasonCodes: ["malware_detected"],
        completedAt: "2026-09-20T10:00:00+08:00",
      }).success,
    ).toBe(true);
  });
});
