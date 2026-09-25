import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * How many of the signed-in member's notifications are unread, for the shell
 * badge. Row-level security limits the count to the member's own rows. Null
 * when there is no session or the count cannot be read: the badge simply does
 * not show, and nothing else on the page depends on it.
 */
export async function countUnreadNotifications(): Promise<number | null> {
  try {
    const client = await createSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return null;
    // `notifications` is not in the generated types yet (see the notification
    // repository's additive contract), so this count reads it untyped.
    const { count, error } = await (client as unknown as SupabaseClient)
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_user_id", user.id)
      .is("read_at", null);
    return error ? null : (count ?? 0);
  } catch {
    return null;
  }
}
