import type { SupabaseClient } from "@supabase/supabase-js";
import type { WantedPictureRepository } from "../services/wanted-picture-service";

/*
 * The picture functions arrived after the generated database types
 * (migration 202610120001), so they are called through an untyped client
 * until the types are regenerated.
 */
type Untyped = SupabaseClient;

/**
 * Everything runs on the caller's own session: the storage policy limits
 * uploads to their own folder, and the database functions decide who may set
 * or remove a picture. No admin client, no RLS bypass.
 */
export class SupabaseWantedPictureRepository implements WantedPictureRepository {
  private readonly client: Untyped;

  constructor(client: SupabaseClient<never> | SupabaseClient) {
    this.client = client as Untyped;
  }

  async ownPublicId(): Promise<string | null> {
    const {
      data: { user },
    } = await this.client.auth.getUser();
    if (!user) return null;
    const { data, error } = await this.client
      .from("profiles")
      .select("public_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    return (data as { public_id: string } | null)?.public_id ?? null;
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
