import { describe, expect, it, vi } from "vitest";
import { ClaimScreeningService, type ClaimScreeningRepository } from "./claim-screening-service";

describe("claim screening service", () => {
  it("records a validated scanner result", async () => {
    const repository: ClaimScreeningRepository = {
      acknowledgeJob: vi.fn(),
      recordResult: vi.fn().mockResolvedValue({ recorded: true }),
    };
    const service = new ClaimScreeningService(repository);
    await expect(
      service.recordResult({
        claimId: "00000000-0000-4000-8000-000000000001",
        status: "clean",
        scannerName: "clamav",
        scannerVersion: "1.0",
        reasonCodes: [],
        completedAt: "2026-09-20T10:00:00+08:00",
      }),
    ).resolves.toEqual({ recorded: true });
    expect(repository.recordResult).toHaveBeenCalledOnce();
  });

  it("requires an error code for failed job acknowledgement", async () => {
    const repository: ClaimScreeningRepository = { acknowledgeJob: vi.fn(), recordResult: vi.fn() };
    await expect(
      new ClaimScreeningService(repository).acknowledgeJob({
        claimId: "00000000-0000-4000-8000-000000000001",
        state: "failed",
      }),
    ).rejects.toThrow("error code");
  });
});
