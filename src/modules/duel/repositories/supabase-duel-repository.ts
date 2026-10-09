import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DuelAchievements,
  DuelLeader,
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

interface LeaderRow {
  publicId: string;
  displayName: string;
  avatarObjectKey: string | null;
  avatarPreset: number | null;
  externalAvatarUrl: string | null;
  kills: number;
  deaths: number;
  draws: number;
}

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

  /** The functions answer JSON shaped by the migration; this names its shape. */
  private static read<T>({ data, error }: { data: unknown; error: unknown }): T {
    if (error) throw error;
    return data as T;
  }

  async record(): Promise<DuelRecord> {
    return SupabaseDuelRepository.read<DuelRecord>(await this.client.rpc("duel_record"));
  }

  async opponents(): Promise<DuelOpponent[]> {
    const rows =
      SupabaseDuelRepository.read<OpponentRow[] | null>(
        await this.client.rpc("list_duel_opponents"),
      ) ?? [];
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

  async startDuel(opponentPublicId: string): Promise<DuelRoundStart> {
    return SupabaseDuelRepository.read<DuelRoundStart>(
      await this.client.rpc("start_duel", { opponent_public_id: opponentPublicId }),
    );
  }

  async finishDuel(
    roundId: string,
    reactionMs: number | null,
    fouls: number,
  ): Promise<DuelRoundResult> {
    return SupabaseDuelRepository.read<DuelRoundResult>(
      await this.client.rpc("finish_duel", { fouls, reaction_ms: reactionMs, round_id: roundId }),
    );
  }

  async recordPractice(
    level: DuelPracticeLevel,
    reactionMs: number | null,
    foul: boolean,
  ): Promise<DuelPracticeResult> {
    return SupabaseDuelRepository.read<DuelPracticeResult>(
      await this.client.rpc("record_duel_practice", { foul, level, reaction_ms: reactionMs }),
    );
  }

  async setListing(listed: boolean): Promise<boolean> {
    return SupabaseDuelRepository.read<boolean>(
      await this.client.rpc("set_duel_listing", { listed }),
    );
  }

  async achievements(): Promise<DuelAchievements> {
    return SupabaseDuelRepository.read<DuelAchievements>(
      await this.client.rpc("duel_achievements_this_month"),
    );
  }

  async claimAchievement(id: string): Promise<"claimed" | "already_claimed"> {
    const outcome = SupabaseDuelRepository.read<string>(
      await this.client.rpc("claim_duel_achievement", { achievement_id: id }),
    );
    return outcome === "already_claimed" ? "already_claimed" : "claimed";
  }

  async leaderboard(): Promise<DuelLeader[]> {
    const rows =
      SupabaseDuelRepository.read<LeaderRow[] | null>(await this.client.rpc("duel_leaderboard")) ??
      [];
    return rows.map((row) => ({
      publicId: row.publicId,
      displayName: row.displayName,
      avatarUrl: resolveAvatarUrl(
        this.client,
        row.avatarObjectKey,
        row.avatarPreset,
        row.externalAvatarUrl,
      ),
      kills: Number(row.kills),
      deaths: Number(row.deaths),
      draws: Number(row.draws),
    }));
  }

  async reset(): Promise<void> {
    SupabaseDuelRepository.read<null>(await this.client.rpc("reset_duel_record"));
  }
}
