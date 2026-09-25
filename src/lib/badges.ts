import type { SupabaseClient } from "@supabase/supabase-js";
import type { MemberBadge } from "@/contracts/console";
import type { Database } from "@/lib/supabase/database.types";

/**
 * The Owner-awarded badge each member wears, if any, keyed by user id. Badges
 * and awards are public reads (migration 202610020002), like avatars.
 */
export async function readMemberBadges(
  client: SupabaseClient<Database>,
  userIds: readonly string[],
): Promise<Map<string, MemberBadge>> {
  const badges = new Map<string, MemberBadge>();
  if (userIds.length === 0) return badges;
  const awards = await client
    .from("badge_awards")
    .select("user_id, badge_id")
    .in("user_id", [...new Set(userIds)])
    .is("revoked_at", null);
  if (awards.error || !awards.data?.length) return badges;
  const designs = await client
    .from("badges")
    .select("id, name, image_object_key")
    .in(
      "id",
      awards.data.map((award) => award.badge_id),
    )
    .is("retired_at", null);
  if (designs.error) return badges;
  const byId = new Map((designs.data ?? []).map((badge) => [badge.id, badge]));
  for (const award of awards.data) {
    const badge = byId.get(award.badge_id);
    if (!badge) continue;
    badges.set(award.user_id, {
      name: badge.name,
      imageUrl: badge.image_object_key
        ? client.storage.from("badges").getPublicUrl(badge.image_object_key).data.publicUrl
        : null,
    });
  }
  return badges;
}
