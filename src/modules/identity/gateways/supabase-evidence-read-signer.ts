import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

import type { EvidenceReadSigner } from "../services/review-read-service";

export class SupabaseEvidenceReadSigner implements EvidenceReadSigner {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async createSignedReadUrl(objectPath: string, expiresInSeconds: number): Promise<string> {
    const result = await this.client.storage
      .from("identity-evidence")
      .createSignedUrl(objectPath, expiresInSeconds);
    if (result.error || !result.data) {
      throw new Error("Evidence read URL creation failed");
    }
    return result.data.signedUrl;
  }
}
