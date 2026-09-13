import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

import type { EvidenceUploadGateway } from "../services/evidence-upload-service";

export class SupabaseEvidenceUploadGateway implements EvidenceUploadGateway {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async createSignedUpload(input: {
    mimeType: "application/pdf" | "image/jpeg" | "image/png";
    objectPath: string;
  }): Promise<{ signedUrl: string; token: string }> {
    const { data, error } = await this.client.storage
      .from("identity-evidence")
      .createSignedUploadUrl(input.objectPath, { upsert: false });

    if (error || !data) {
      throw new Error("Evidence upload URL creation failed");
    }

    return { signedUrl: data.signedUrl, token: data.token };
  }
}
