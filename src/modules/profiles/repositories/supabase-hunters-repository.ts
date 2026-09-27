import type { SupabaseClient } from "@supabase/supabase-js";
import type { PublicHunter } from "@/contracts/profiles";
import { resolveAvatarUrl } from "@/lib/avatars";
import type { HuntersRepository } from "../services/hunters-service";

/**
 * `list_public_hunters` of migration 202610140001. It is not yet in the
 * generated database types, so the client is used untyped here, as in
 * `supabase-wanted-poster-repository.ts`. Regenerate the types once the
 * migration is applied and drop the cast.
 *
 * The client is the viewer's own session: the function checks the viewer's
 * email itself, so no privileged client is needed.
 */
type Untyped = SupabaseClient;

interface HunterRow {
  publicId: string;
  displayName: string;
  avatarObjectKey: string | null;
  avatarPreset: number | null;
  institutionName: string;
  joinedAt: string;
}

export class SupabaseHuntersRepository implements HuntersRepository {
  private readonly client: Untyped;

  constructor(client: unknown) {
    this.client = client as Untyped;
  }

  async listPage(
    pageSize: number,
    page: number,
  ): Promise<{ total: number; items: PublicHunter[] }> {
    const { data, error } = await this.client.rpc("list_public_hunters", {
      page,
      page_size: pageSize,
    });
    if (error) throw error;
    const body = data as { total: number; items: HunterRow[] } | null;
    return {
      total: Number(body?.total ?? 0),
      items: (body?.items ?? []).map((row) => ({
        publicId: row.publicId,
        displayName: row.displayName,
        avatarUrl: resolveAvatarUrl(this.client, row.avatarObjectKey, row.avatarPreset),
        institutionName: row.institutionName,
        joinedAt: new Date(row.joinedAt).toISOString(),
      })),
    };
  }
}
