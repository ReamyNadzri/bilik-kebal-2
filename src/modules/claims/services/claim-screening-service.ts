import { claimScreeningResultSchema, type ClaimScreeningResult } from "@/contracts/claim-screening";

export interface ClaimScreeningRepository {
  recordResult(input: ClaimScreeningResult): Promise<{ recorded: boolean }>;
  acknowledgeJob(input: {
    claimId: string;
    state: "completed" | "failed";
    errorCode?: string;
  }): Promise<void>;
}

export class ClaimScreeningService {
  constructor(private readonly repository: ClaimScreeningRepository) {}

  async recordResult(input: unknown): Promise<{ recorded: boolean }> {
    const result = claimScreeningResultSchema.parse(input);
    return this.repository.recordResult(result);
  }

  async acknowledgeJob(input: {
    claimId: string;
    state: "completed" | "failed";
    errorCode?: string;
  }) {
    if (!input.claimId.match(/^[0-9a-f-]{36}$/i)) throw new Error("Invalid claim id");
    if (input.state === "failed" && !input.errorCode)
      throw new Error("Failed jobs require an error code");
    return this.repository.acknowledgeJob(input);
  }
}
