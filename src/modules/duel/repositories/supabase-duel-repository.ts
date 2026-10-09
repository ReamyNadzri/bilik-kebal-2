import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DuelOpponent,
  DuelPracticeLevel,
  DuelPracticeResult,
  DuelRecord,
  DuelRoundResult,
  DuelRoundStart,
} from "@/contracts/duel";
import { resolveAvatarUrl } from "@/lib/avatars";
import type { Database } from "@/lib/supabase/database";
import type { DuelRepository } from "../services/duel-service";

type Client = SupabaseClient<Database>;

/**
 * The functions of migration 202610210001 are not in the generated types until
 * the migration is applied and `database.types.ts` is regenerated; until then
 * they are called through this narrow untyped view. Drop it after regenerating.
 */
type UntypedRpc = {
  rpc(
    name: string,
    args?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

interface OpponentRow {
  publicId: string;
  displayName: string;
  avatarObjectKey: string | null;
  avatarPreset: number | null;
  externalAvatarUrl: string | null;
  institutionName: string | null;
  averageMs: number;
  bestMs: number;
  wins: number;
  losses: number;
  draws: number;
}

/**
 * Everything runs on the caller's own session: the database functions check
 * who is asking, draw the ghost's time and decide each round. No admin client,
 * no RLS bypass.
 */
export class SupabaseDuelRepository implements DuelRepository {
  constructor(private readonly client: Client) {}

  private async call<T>(name: string, args?: Record<string, unknown>): Promise<T> {
    const { data, error } = await (this.client as unknown as UntypedRpc).rpc(name, args);
    if (error) throw error;
    return data as T;
  }

  record(): Promise<DuelRecord> {
    return this.call<DuelRecord>("duel_record");
  }

  async opponents(): Promise<DuelOpponent[]> {
    const rows = (await this.call<OpponentRow[] | null>("list_duel_opponents")) ?? [];
    return rows.map((row) => ({
      publicId: row.publicId,
      displayName: row.displayName,
      avatarUrl: resolveAvatarUrl(
        this.client,
        row.avatarObjectKey,
        row.avatarPreset,
        row.externalAvatarUrl,
      ),
      institutionName: row.institutionName,
      averageMs: Number(row.averageMs),
      bestMs: Number(row.bestMs),
      wins: Number(row.wins),
      losses: Number(row.losses),
      draws: Number(row.draws),
    }));
  }

  startDuel(opponentPublicId: string): Promise<DuelRoundStart> {
    return this.call<DuelRoundStart>("start_duel", { opponent_public_id: opponentPublicId });
  }

  finishDuel(roundId: string, reactionMs: number | null, fouls: number): Promise<DuelRoundResult> {
    return this.call<DuelRoundResult>("finish_duel", {
      fouls,
      reaction_ms: reactionMs,
      round_id: roundId,
    });
  }

  recordPractice(
    level: DuelPracticeLevel,
    reactionMs: number | null,
    foul: boolean,
  ): Promise<DuelPracticeResult> {
    return this.call<DuelPracticeResult>("record_duel_practice", {
      foul,
      level,
      reaction_ms: reactionMs,
    });
  }

  setListing(listed: boolean): Promise<boolean> {
    return this.call<boolean>("set_duel_listing", { listed });
  }

  async reset(): Promise<void> {
    await this.call<null>("reset_duel_record");
  }
}
