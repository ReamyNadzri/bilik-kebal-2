import type { SupabaseClient } from "@supabase/supabase-js";
import type { WantedChangeLock, WantedChangeWindow } from "@/contracts/marketplace";
import type { WantedPosterRepository } from "../services/wanted-poster-service";

/**
 * The poster-change RPCs of migration 202610130002. They are not yet in the
 * generated database types, so the client is used untyped here, as in
 * `supabase-wanted-picture-repository.ts`. Regenerate the types once the
 * migration is applied and drop the cast.
 */
type Untyped = SupabaseClient;

export class SupabaseWantedPosterRepository implements WantedPosterRepository {
  private readonly client: Untyped;

  constructor(client: unknown) {
    this.client = client as Untyped;
  }

  async readChangeWindow(publicId: string): Promise<WantedChangeWindow | null> {
    const { data, error } = await this.client.rpc("my_wanted_change_window", {
      target_public_id: publicId,
    });
    if (error) throw error;
    const row = (
      data as Array<{ editable_until: string; locked_reason: string | null }> | null
    )?.[0];
    if (!row) return null;
    return {
      editableUntil: new Date(row.editable_until).toISOString(),
      lockedReason: row.locked_reason as WantedChangeLock | null,
    };
  }

  async updatePublishedWanted(publicId: string, title: string, description: string) {
    const { error } = await this.client.rpc("update_own_published_wanted", {
      new_description: description,
      new_title: title,
      target_public_id: publicId,
    });
    if (error) throw error;
  }

  async withdrawWanted(publicId: string): Promise<number> {
    const { data, error } = await this.client.rpc("withdraw_own_wanted", {
      target_public_id: publicId,
    });
    if (error) throw error;
    return Number(data ?? 0);
  }
}
