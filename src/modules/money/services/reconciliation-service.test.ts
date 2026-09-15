import { describe, expect, it, vi } from "vitest";
import { ReconciliationService } from "./reconciliation-service";

describe("ReconciliationService", () => {
  it("bounds operator queries and never mutates financial state", async () => {
    const repository = { listUnresolvedProviderEvents: vi.fn().mockResolvedValue([]) };
    await expect(new ReconciliationService(repository).list(9999)).resolves.toEqual([]);
    expect(repository.listUnresolvedProviderEvents).toHaveBeenCalledWith(500);
  });
});
