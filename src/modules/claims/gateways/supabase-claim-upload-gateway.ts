import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

import type { ClaimUploadGateway } from "../services/claim-upload-service";

export class SupabaseClaimUploadGateway implements ClaimUploadGateway {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async createSignedUpload(input: Parameters<ClaimUploadGateway["createSignedUpload"]>[0]) {
    const { data, error } = await this.client.storage
      .from("quarantine")
      .createSignedUploadUrl(input.objectKey, { upsert: false });
    if (error || !data) throw new Error("Claim upload URL creation failed");
    return { signedUrl: data.signedUrl, token: data.token };
  }
}
