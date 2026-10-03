import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/lib/supabase/database";
import { SupabaseClaimReviewRepository } from "./supabase-claim-review-repository";

const CLAIM = "00000000-0000-4000-8000-000000000001";

function repositoryWith(result: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(result);
  const client = { rpc } as unknown as SupabaseClient<Database>;
  return { rpc, repository: new SupabaseClaimReviewRepository(client) };
}

describe("SupabaseClaimReviewRepository approvals", () => {
  it("returns the payout task id of a paid request", async () => {
    const { repository, rpc } = repositoryWith({ data: "payout-1", error: null });
    await expect(
      repository.recordReview({
        claimId: CLAIM,
        decision: "approve",
        reasonCode: "meets_request",
        notes: null,
      }),
    ).resolves.toBe("payout-1");
    expect(rpc).toHaveBeenCalledWith("approve_winning_claim_and_fulfill", {
      target_claim_id: CLAIM,
      target_reason_code: "meets_request",
    });
  });

  it("treats a free request's approval, which has no payout, as recorded", async () => {
    const { repository } = repositoryWith({ data: null, error: null });
    await expect(
      repository.recordReview({
        claimId: CLAIM,
        decision: "approve",
        reasonCode: "meets_request",
        notes: null,
      }),
    ).resolves.toBe(CLAIM);
  });

  it("throws when the approval is refused", async () => {
    const { repository } = repositoryWith({ data: null, error: { message: "denied" } });
    await expect(
      repository.recordReview({
        claimId: CLAIM,
        decision: "approve",
        reasonCode: "meets_request",
        notes: null,
      }),
    ).rejects.toThrow("Claim approval and fulfillment failed");
  });
});
