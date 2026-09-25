import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ConsoleBadge,
  ConsoleMember,
  ConsoleMemberAction,
  ConsoleRole,
  HiddenReply,
} from "@/contracts/console";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

export interface ConsoleRepository {
  myRole(): Promise<ConsoleRole | null>;
  searchMembers(search: string | null): Promise<ConsoleMember[]>;
  act(publicId: string, action: ConsoleMemberAction): Promise<void>;
  listHiddenReplies(): Promise<HiddenReply[]>;
  restoreReply(replyId: string): Promise<void>;
  listBadges(): Promise<ConsoleBadge[]>;
  createBadge(input: {
    name: string;
    description: string | null;
    imageKey: string | null;
  }): Promise<string>;
  retireBadge(badgeId: string): Promise<void>;
  createBadgeUpload(imageKey: string): Promise<{ signedUrl: string; token: string }>;
}

/**
 * The console runs entirely on the caller's own session: every read and write
 * is a database function that checks the caller's role, so no admin client
 * is involved and RLS is never bypassed.
 */
export class SupabaseConsoleRepository implements ConsoleRepository {
  constructor(private readonly client: Client) {}

  async myRole(): Promise<ConsoleRole | null> {
    const { data, error } = await this.client.rpc("console_my_role");
    if (error) throw error;
    return (data as ConsoleRole | null) ?? null;
  }

  async searchMembers(search: string | null): Promise<ConsoleMember[]> {
    const { data, error } = await this.client.rpc("console_search_members", {
      max_rows: 50,
      search,
    });
    if (error) throw error;
    return (data as unknown as ConsoleMember[]) ?? [];
  }

  async act(publicId: string, action: ConsoleMemberAction): Promise<void> {
    const target_public_id = publicId;
    const call = () => {
      switch (action.action) {
        case "rename":
          return this.client.rpc("console_rename_member", {
            new_name: action.name,
            reason_code: action.reasonCode,
            target_public_id,
          });
        case "reset_avatar":
          return this.client.rpc("console_reset_member_avatar", {
            reason_code: action.reasonCode,
            target_public_id,
          });
        case "timeout":
          return this.client.rpc("console_timeout_member", {
            duration_hours: action.hours,
            reason_code: action.reasonCode,
            target_public_id,
          });
        case "restrict":
          return this.client.rpc("console_restrict_member", {
            reason_code: action.reasonCode,
            target_public_id,
          });
        case "lift":
          return this.client.rpc("console_lift_member_restriction", { target_public_id });
        case "set_verification":
          return this.client.rpc("console_set_institution_verification", {
            reason_code: action.reasonCode,
            target_institution_id: action.institutionId,
            target_public_id,
            verified: action.verified,
          });
        case "set_sheriff":
          return this.client.rpc("console_set_sheriff", {
            appoint: action.appoint,
            target_institution_id: action.institutionId,
            target_public_id,
          });
        case "set_badge":
          return this.client.rpc("set_member_badge", {
            target_badge_id: action.badgeId,
            target_public_id,
          });
      }
    };
    const { error } = await call();
    if (error) throw error;
  }

  async listHiddenReplies(): Promise<HiddenReply[]> {
    const { data, error } = await this.client.rpc("console_list_hidden_replies", { max_rows: 100 });
    if (error) throw error;
    return (data as unknown as HiddenReply[]) ?? [];
  }

  async restoreReply(replyId: string): Promise<void> {
    const { error } = await this.client.rpc("set_wanted_reply_hidden", {
      hide: false,
      target_reply_id: replyId,
    });
    if (error) throw error;
  }

  async listBadges(): Promise<ConsoleBadge[]> {
    const [badges, awards] = await Promise.all([
      this.client
        .from("badges")
        .select("id, name, description, image_object_key, retired_at")
        .order("created_at", { ascending: false }),
      this.client.from("badge_awards").select("badge_id").is("revoked_at", null),
    ]);
    if (badges.error) throw badges.error;
    if (awards.error) throw awards.error;
    const holders = new Map<string, number>();
    for (const award of awards.data ?? []) {
      holders.set(award.badge_id, (holders.get(award.badge_id) ?? 0) + 1);
    }
    return (badges.data ?? []).map((badge) => ({
      id: badge.id,
      name: badge.name,
      description: badge.description,
      imageUrl: badgeImageUrl(this.client, badge.image_object_key),
      retired: badge.retired_at !== null,
      holders: holders.get(badge.id) ?? 0,
    }));
  }

  async createBadge(input: {
    name: string;
    description: string | null;
    imageKey: string | null;
  }): Promise<string> {
    const { data, error } = await this.client.rpc("create_badge", {
      badge_description: input.description,
      badge_name: input.name,
      image_key: input.imageKey,
    });
    if (error) throw error;
    return data;
  }

  async retireBadge(badgeId: string): Promise<void> {
    const { error } = await this.client.rpc("retire_badge", { target_badge_id: badgeId });
    if (error) throw error;
  }

  /** The storage policy lets only the Owner write to the public `badges` bucket. */
  async createBadgeUpload(imageKey: string): Promise<{ signedUrl: string; token: string }> {
    const { data, error } = await this.client.storage
      .from("badges")
      .createSignedUploadUrl(imageKey, { upsert: false });
    if (error || !data) throw error ?? new Error("Badge upload URL creation failed");
    return { signedUrl: data.signedUrl, token: data.token };
  }
}

/** Public URL of a badge image in the `badges` bucket, or null. */
export function badgeImageUrl(client: Client, objectKey: string | null): string | null {
  return objectKey ? client.storage.from("badges").getPublicUrl(objectKey).data.publicUrl : null;
}
