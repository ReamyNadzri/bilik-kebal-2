import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

import type { ClaimRepository } from "../services/claim-upload-service";

export class SupabaseClaimsRepository implements ClaimRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async createClaim(input: Parameters<ClaimRepository["createClaim"]>[0]) {
    const { data, error } = await this.client.rpc("create_claim_upload_session", {
      target_expires_at: input.expiresAt,
      target_file_name: input.submission.fileName,
      target_free_release_opt_in: input.submission.freeReleaseOptIn,
      target_mime_type: input.submission.mimeType,
      target_object_key: input.objectKey,
      target_sha256_hex: input.submission.sha256,
      target_size_bytes: input.submission.sizeBytes,
      target_wanted_id: input.submission.wantedId,
    });
    const row = data?.[0];
    if (error || !row) throw new Error("Claim upload session creation failed");
    return { claimId: row.claim_id, objectKey: row.object_key };
  }
}
