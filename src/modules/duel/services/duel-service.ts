import { failure, success } from "@/contracts/operation-result";
import {
  duelListingInputSchema,
  duelPracticeInputSchema,
  finishDuelInputSchema,
  startDuelInputSchema,
  type DuelListingResult,
  type DuelLobbyResult,
  type DuelOpponent,
  type DuelPracticeLevel,
  type DuelPracticeResult,
  type DuelPracticeShotResult,
  type DuelRecord,
  type DuelRoundResult,
  type DuelRoundStart,
  type FinishDuelResult,
  type ResetDuelRecordResult,
  type StartDuelResult,
} from "@/contracts/duel";

export interface DuelRepository {
  record(): Promise<DuelRecord>;
  opponents(): Promise<DuelOpponent[]>;
  startDuel(opponentPublicId: string): Promise<DuelRoundStart>;
  finishDuel(roundId: string, reactionMs: number | null, fouls: number): Promise<DuelRoundResult>;
  recordPractice(
    level: DuelPracticeLevel,
    reactionMs: number | null,
    foul: boolean,
  ): Promise<DuelPracticeResult>;
  setListing(listed: boolean): Promise<boolean>;
  reset(): Promise<void>;
}

export interface DuelActor {
  readonly userId: string;
  readonly emailVerified: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function databaseMessage(error: unknown): string {
  return typeof error === "object" && error !== null && "message" in error
    ? String((error as { message: unknown }).message)
    : "";
}

const SIGN_IN = "Sign in to duel.";
const VERIFY = "Verify your email to duel.";
const UNAVAILABLE = "The Duel is unavailable right now. Try again.";

/**
 * Turns a database refusal into a sentence the member can act on. Database
 * wording never reaches the browser.
 */
function refusal(error: unknown) {
  const message = databaseMessage(error);
  if (message.includes("duel_auth_required")) return failure("AUTH_REQUIRED" as const, SIGN_IN);
  if (message.includes("EMAIL_NOT_VERIFIED")) return failure("EMAIL_NOT_VERIFIED" as const, VERIFY);
  if (message.includes("duel_opponent_unavailable")) {
    return failure(
      "OPPONENT_UNAVAILABLE" as const,
      "That hunter can no longer be challenged. Pick another opponent.",
    );
  }
  if (message.includes("duel_too_soon")) {
    return failure("TOO_SOON" as const, "Catch your breath: wait a moment before the next duel.");
  }
  if (message.includes("duel_round_not_found")) {
    return failure("ROUND_NOT_FOUND" as const, "This duel was not found. Start a new one.");
  }
  if (message.includes("duel_round_expired") || message.includes("duel_round_too_fast")) {
    return failure("ROUND_EXPIRED" as const, "This duel did not count. Start a new one.");
  }
  if (message.includes("duel_reaction_invalid") || message.includes("duel_listing_invalid")) {
    return failure("VALIDATION_ERROR" as const, "That shot could not be recorded.");
  }
  return failure("DUEL_UNAVAILABLE" as const, UNAVAILABLE);
}

/**
 * The Duel against members' ghosts (migration 202610210001). The database
 * draws each ghost's time and decides each round; these checks only refuse
 * early and keep database wording out of the browser.
 */
export class DuelService {
  constructor(private readonly repository: DuelRepository) {}

  private guard(actor: DuelActor | null) {
    if (!actor) return failure("AUTH_REQUIRED" as const, SIGN_IN);
    if (!actor.emailVerified) return failure("EMAIL_NOT_VERIFIED" as const, VERIFY);
    return null;
  }

  async lobby(actor: DuelActor | null): Promise<DuelLobbyResult> {
    const refused = this.guard(actor);
    if (refused) return refused;
    try {
      const [record, opponents] = await Promise.all([
        this.repository.record(),
        this.repository.opponents(),
      ]);
      return success({ record, opponents });
    } catch (error) {
      return refusal(error);
    }
  }

  async start(actor: DuelActor | null, input: unknown): Promise<StartDuelResult> {
    const refused = this.guard(actor);
    if (refused) return refused;
    const parsed = startDuelInputSchema.safeParse(input);
    if (!parsed.success) return failure("VALIDATION_ERROR", "Pick an opponent to duel.");
    try {
      return success(await this.repository.startDuel(parsed.data.opponentPublicId));
    } catch (error) {
      return refusal(error);
    }
  }

  async finish(
    actor: DuelActor | null,
    roundId: string,
    input: unknown,
  ): Promise<FinishDuelResult> {
    const refused = this.guard(actor);
    if (refused) return refused;
    const parsed = finishDuelInputSchema.safeParse(input);
    if (!UUID.test(roundId) || !parsed.success) {
      return failure("VALIDATION_ERROR", "That shot could not be recorded.");
    }
    try {
      return success(
        await this.repository.finishDuel(roundId, parsed.data.reactionMs, parsed.data.fouls),
      );
    } catch (error) {
      return refusal(error);
    }
  }

  async practice(actor: DuelActor | null, input: unknown): Promise<DuelPracticeShotResult> {
    const refused = this.guard(actor);
    if (refused) return refused;
    const parsed = duelPracticeInputSchema.safeParse(input);
    if (!parsed.success) return failure("VALIDATION_ERROR", "That shot could not be recorded.");
    try {
      const { level, reactionMs, foul } = parsed.data;
      return success(await this.repository.recordPractice(level, reactionMs, foul));
    } catch (error) {
      return refusal(error);
    }
  }

  async setListing(actor: DuelActor | null, input: unknown): Promise<DuelListingResult> {
    const refused = this.guard(actor);
    if (refused) return refused;
    const parsed = duelListingInputSchema.safeParse(input);
    if (!parsed.success) return failure("VALIDATION_ERROR", "Choose whether others may duel you.");
    try {
      return success({ listed: await this.repository.setListing(parsed.data.listed) });
    } catch (error) {
      return refusal(error);
    }
  }

  async reset(actor: DuelActor | null): Promise<ResetDuelRecordResult> {
    const refused = this.guard(actor);
    if (refused) return refused;
    try {
      await this.repository.reset();
      return success({ reset: true as const });
    } catch (error) {
      return refusal(error);
    }
  }
}
