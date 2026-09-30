import type { SupabaseClient } from "@supabase/supabase-js";

import type { ClerkUserSyncInput, ClerkUserSyncRepository } from "../services/clerk-user-sync";

/**
 * `sync_clerk_user` (migration 202610160002) is service-role only, so the
 * client must be the admin client. Untyped until the database types are
 * regenerated.
 */
type Untyped = SupabaseClient;

export class SupabaseClerkUserSyncRepository implements ClerkUserSyncRepository {
  private readonly client: Untyped;

  constructor(client: unknown) {
    this.client = client as Untyped;
  }

  async syncUser(input: ClerkUserSyncInput): Promise<void> {
    const { error } = await this.client.rpc("sync_clerk_user", {
      target_clerk_user_id: input.clerkUserId,
      target_external_id: input.externalId,
      target_email: input.email,
      target_email_verified: input.emailVerified,
      target_display_name: input.displayName,
      target_clerk_updated_at: input.clerkUpdatedAt.toISOString(),
    });
    // The database error can carry the email; only its code leaves this layer.
    if (error) throw new Error(`CLERK_USER_SYNC_FAILED:${error.code ?? "unknown"}`);

    // After the account row exists, with the same Clerk timestamp, so a stale
    // delivery changes nothing (migration 202610170001). Best effort: a missing
    // photo must never stop an account from being created; the next Clerk
    // update or session sync brings it.
    await this.client.rpc("sync_clerk_avatar", {
      target_clerk_user_id: input.clerkUserId,
      target_avatar_url: input.googleAvatarUrl,
      target_clerk_updated_at: input.clerkUpdatedAt.toISOString(),
    });
  }
}
