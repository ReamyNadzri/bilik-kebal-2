import type { SupabaseClient } from "@supabase/supabase-js";
import type { PublicProfile } from "@/contracts/profiles";
import type { Database } from "@/lib/supabase/database.types";
import { SupabaseWantedRepository } from "@/modules/wanted/repositories/supabase-wanted-repository";

type Client = SupabaseClient<Database>;

export interface ProfileRepository {
  updateOwnProfile(displayName: string, bio: string | null): Promise<void>;
  setOwnAvatar(objectKey: string | null): Promise<void>;
  avatarUrl(objectKey: string | null): string | null;
  readPublicProfile(publicId: string): Promise<PublicProfile | null>;
}

/**
 * Writes go through the signed-in user's client, so the database re-checks
 * ownership (`update_own_profile`, `set_own_avatar`). Public reads take a
 * separate read client the loader chooses after checking the viewer.
 */
export class SupabaseProfileRepository implements ProfileRepository {
  constructor(
    private readonly writeClient: Client,
    private readonly readClient: Client = writeClient,
  ) {}

  async updateOwnProfile(displayName: string, bio: string | null): Promise<void> {
    const { error } = await this.writeClient.rpc("update_own_profile", {
      new_bio: bio,
      new_display_name: displayName,
    });
    if (error) throw error;
  }

  async setOwnAvatar(objectKey: string | null): Promise<void> {
    const { error } = await this.writeClient.rpc("set_own_avatar", { new_object_key: objectKey });
    if (error) throw error;
  }

  avatarUrl(objectKey: string | null): string | null {
    if (!objectKey) return null;
    return this.readClient.storage.from("avatars").getPublicUrl(objectKey).data.publicUrl;
  }

  async readPublicProfile(publicId: string): Promise<PublicProfile | null> {
    const profile = await this.readClient
      .from("profiles")
      .select("user_id, public_id, display_name, avatar_object_key, bio, created_at")
      .eq("public_id", publicId)
      .maybeSingle();
    if (profile.error) throw profile.error;
    if (!profile.data) return null;
    const [memberships, wanted] = await Promise.all([
      this.readClient
        .from("institution_memberships")
        .select("institution_id, verification_state, verified_at")
        .eq("user_id", profile.data.user_id)
        .eq("verification_state", "verified")
        .order("verified_at", { ascending: false })
        .limit(1),
      this.readClient
        .from("wanted_requests")
        .select("id")
        .eq("commissioner_user_id", profile.data.user_id)
        .in("status", ["open", "reviewing", "expired", "fulfilled", "closed"]),
    ]);
    if (memberships.error || wanted.error) throw memberships.error ?? wanted.error;
    const membership = memberships.data?.[0];
    const institution = membership
      ? await this.readClient
          .from("institutions")
          .select("name")
          .eq("id", membership.institution_id)
          .maybeSingle()
      : { data: null, error: null };
    if (institution.error) throw institution.error;
    const summaries = await new SupabaseWantedRepository(this.readClient).listWantedByIds(
      (wanted.data ?? []).map((row) => row.id),
    );
    return {
      publicId: profile.data.public_id,
      displayName: profile.data.display_name,
      avatarUrl: this.avatarUrl(profile.data.avatar_object_key),
      bio: profile.data.bio,
      joinedAt: profile.data.created_at,
      institutionName: institution.data?.name ?? null,
      institutionVerified: membership !== undefined,
      wanted: summaries,
    };
  }
}
