import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database";
import type { ClaimFilePurpose } from "@/contracts/claim-reviews";
import type {
  ClaimFileRefusal,
  ClaimFileReviewGateway,
  ReviewClaimFile,
} from "../services/claim-file-review-service";
import {
  signClaimFile,
  type ClaimFileLocation,
  type SignOutcome,
} from "../storage/promote-approved-claim-file";

const REFUSAL_BY_SQLSTATE: Record<string, ClaimFileRefusal> = {
  "42501": "forbidden",
  P0002: "not_found",
  "28000": "auth",
  "22023": "invalid",
};

/**
 * `client` is the member's session, so the database authorises and audits.
 * `createAdmin` (service role) is used only to sign what the database released:
 * no storage policy lets a member read the quarantine or approved buckets.
 */
export class SupabaseClaimFileReviewGateway implements ClaimFileReviewGateway {
  constructor(
    private readonly client: SupabaseClient<Database>,
    private readonly createAdmin: () => SupabaseClient<Database>,
  ) {}

  async authorise(
    claimId: string,
    purpose: ClaimFilePurpose,
  ): Promise<{ ok: true; file: ReviewClaimFile } | { ok: false; reason: ClaimFileRefusal }> {
    const { data, error } = await this.client.rpc("review_claim_file_access", {
      target_claim_id: claimId,
      target_purpose: purpose,
    });
    if (error) return { ok: false, reason: REFUSAL_BY_SQLSTATE[error.code] ?? "unavailable" };
    const row = data?.[0];
    if (!row) return { ok: false, reason: "not_found" };
    return {
      ok: true,
      file: {
        bucket: row.bucket,
        objectKey: row.object_key,
        fileName: row.file_name,
        mimeType: row.mime_type,
      },
    };
  }

  sign(
    file: ClaimFileLocation,
    expiresInSeconds: number,
    options: { download: string } | undefined,
  ): Promise<SignOutcome> {
    return signClaimFile(this.createAdmin().storage, file, expiresInSeconds, options);
  }
}
