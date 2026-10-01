import type { SupabaseClient } from "@supabase/supabase-js";
import type { PublicHunter } from "@/contracts/profiles";
import { resolveAvatarUrl } from "@/lib/avatars";
import { readMemberBadges } from "@/lib/badges";
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
  /** Absent until migration 202610170001 is applied. */
  externalAvatarUrl?: string | null;
  institutionName: string;
  joinedAt: string;
}

export class SupabaseHuntersRepository implements HuntersRepository {
  private readonly client: Untyped;

  /**
   * `institutionId` limits the wall to one university
   * (`list_public_hunters_at`, migration 202610150005); null lists everyone.
   */
  private readonly badgeClient: Untyped | null;

  /**
   * `badgeClient` reads each Hunter's Owner-awarded badge; badges are public
   * (migration 202610100004), but finding a Hunter's account from their public
   * id needs the service client. Without it, posters carry no badge.
   */
  constructor(
    client: unknown,
    private readonly institutionId: string | null = null,
    badgeClient: unknown = null,
  ) {
    this.client = client as Untyped;
    this.badgeClient = badgeClient as Untyped | null;
  }

  private async badgesFor(
    publicIds: readonly string[],
  ): Promise<Map<string, PublicHunter["badge"]>> {
    const byPublicId = new Map<string, PublicHunter["badge"]>();
    if (this.badgeClient === null || publicIds.length === 0) return byPublicId;
    try {
      const owners = await this.badgeClient
        .from("profiles")
        .select("user_id, public_id")
        .in("public_id", [...publicIds]);
      if (owners.error || !owners.data?.length) return byPublicId;
      const rows = owners.data as { user_id: string; public_id: string }[];
      const badges = await readMemberBadges(
        this.badgeClient as never,
        rows.map((row) => row.user_id),
      );
      for (const row of rows) {
        const badge = badges.get(row.user_id);
        if (badge) byPublicId.set(row.public_id, badge);
      }
    } catch {
      // A badge is decoration; the wall still shows without it.
    }
    return byPublicId;
  }

  async listPage(
    pageSize: number,
    page: number,
  ): Promise<{ total: number; items: PublicHunter[] }> {
    const { data, error } =
      this.institutionId === null
        ? await this.client.rpc("list_public_hunters", { page, page_size: pageSize })
        : await this.client.rpc("list_public_hunters_at", {
            page,
            page_size: pageSize,
            target_institution_id: this.institutionId,
          });
    if (error) throw error;
    const body = data as { total: number; items: HunterRow[] } | null;
    const rows = body?.items ?? [];
    const badges = await this.badgesFor(rows.map((row) => row.publicId));
    return {
      total: Number(body?.total ?? 0),
      items: rows.map((row) => ({
        publicId: row.publicId,
        displayName: row.displayName,
        avatarUrl: resolveAvatarUrl(
          this.client,
          row.avatarObjectKey,
          row.avatarPreset,
          row.externalAvatarUrl,
        ),
        institutionName: row.institutionName,
        joinedAt: new Date(row.joinedAt).toISOString(),
        badge: badges.get(row.publicId) ?? null,
      })),
    };
  }
}
