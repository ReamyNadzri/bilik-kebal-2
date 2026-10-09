import { failure, type OperationResult } from "@/contracts/operation-result";
import type {
  ClaimDuelTopicResult,
  DuelLeaderboardResult,
  DuelListingResult,
  DuelLobbyResult,
  DuelPracticeShotResult,
  FinishDuelResult,
  ResetDuelRecordResult,
  StartDuelResult,
} from "@/contracts/duel";
import { getRequestSupabaseClient, getRequestUser } from "@/lib/supabase/server";
import { SupabaseDuelRepository } from "../repositories/supabase-duel-repository";
import { DuelService, type DuelActor } from "../services/duel-service";

/** The actor comes from the request's shared Auth check, not a check of its own. */
async function context(): Promise<{ actor: DuelActor | null; service: DuelService }> {
  const client = await getRequestSupabaseClient();
  const {
    data: { user },
  } = await getRequestUser();
  return {
    actor: user ? { userId: user.id, emailVerified: Boolean(user.email_confirmed_at) } : null,
    service: new DuelService(new SupabaseDuelRepository(client)),
  };
}

type Loaded = Awaited<ReturnType<typeof context>>;

async function run<T extends OperationResult<unknown, string>>(
  operation: (loaded: Loaded) => Promise<T>,
): Promise<T | ReturnType<typeof unavailable>> {
  try {
    return await operation(await context());
  } catch {
    return unavailable();
  }
}

const unavailable = () =>
  failure("DUEL_UNAVAILABLE" as const, "The Duel is unavailable right now. Try again.");

export const loadDuelLobby = (): Promise<DuelLobbyResult> =>
  run(({ actor, service }) => service.lobby(actor));

export const startDuel = (input: unknown): Promise<StartDuelResult> =>
  run(({ actor, service }) => service.start(actor, input));

export const finishDuel = (roundId: string, input: unknown): Promise<FinishDuelResult> =>
  run(({ actor, service }) => service.finish(actor, roundId, input));

export const recordDuelPractice = (input: unknown): Promise<DuelPracticeShotResult> =>
  run(({ actor, service }) => service.practice(actor, input));

export const setDuelListing = (input: unknown): Promise<DuelListingResult> =>
  run(({ actor, service }) => service.setListing(actor, input));

export const claimDuelTopic = (topic: string): Promise<ClaimDuelTopicResult> =>
  run(({ actor, service }) => service.claimTopic(actor, topic));

/** The front page's top three by K/D. */
export const loadDuelLeaderboard = (): Promise<DuelLeaderboardResult> =>
  run(({ actor, service }) => service.leaderboard(actor));

export const resetDuelRecord = (): Promise<ResetDuelRecordResult> =>
  run(({ actor, service }) => service.reset(actor));
