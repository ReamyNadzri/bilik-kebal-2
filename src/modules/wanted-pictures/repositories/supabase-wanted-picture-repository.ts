import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database";
import type { WantedPictureRepository } from "../services/wanted-picture-service";

/**
 * Everything runs on the caller's own session: the storage policy limits
 * uploads to their own folder, and the database functions decide who may set
 * or remove a picture. No admin client, no RLS bypass.
 */
export class SupabaseWantedPictureRepository implements WantedPictureRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  /** Read through `current_identity` (migration 202610160003): a Clerk-token client has no `auth` API. */
  async ownPublicId(): Promise<string | null> {
    const { data, error } = await this.client.rpc("current_identity");
    if (error) throw error;
    return data?.[0]?.public_id ?? null;
  }

  async createUpload(objectKey: string): Promise<{ signedUrl: string }> {
    const { data, error } = await this.client.storage
      .from("wanted-pictures")
      .createSignedUploadUrl(objectKey, { upsert: false });
    if (error || !data) throw error ?? new Error("Wanted picture upload URL creation failed");
    return { signedUrl: data.signedUrl };
  }

  async setOwn(ref: string, preset: number | null, objectKey: string | null): Promise<void> {
    const { error } = await this.client.rpc("set_own_wanted_picture", {
      new_object_key: objectKey,
      new_preset: preset,
      target_wanted_ref: ref,
    });
    if (error) throw error;
  }

  async remove(ref: string, reasonCode: string): Promise<void> {
    const { error } = await this.client.rpc("remove_wanted_picture", {
      reason_code: reasonCode,
      target_wanted_ref: ref,
    });
    if (error) throw error;
  }
}
