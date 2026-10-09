import { failure, success } from "@/contracts/operation-result";
import {
  type ClaimDuelTopicResult,
  type DuelAchievements,
  type DuelLeader,
  type DuelLeaderboardResult,
  type DuelOpenRoom,
  type DuelOpenRoomsResult,
  type DuelRoomResultEnvelope,
  type DuelRoomState,
  type LeaveDuelRoomResult,
  duelRoomShotInputSchema,
  joinDuelRoomInputSchema,
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
  achievements(): Promise<DuelAchievements>;
  claimTopic(topic: string): Promise<"claimed" | "already_claimed">;
  leaderboard(): Promise<DuelLeader[]>;
  openRoom(): Promise<DuelRoomState>;
  openRooms(): Promise<DuelOpenRoom[]>;
  joinRoom(code: string): Promise<DuelRoomState>;
  roomState(roomId: string): Promise<DuelRoomState>;
  roomShot(
    roomId: string,
    roundNumber: number,
    reactionMs: number | null,
    foul: boolean,
  ): Promise<DuelRoomState>;
  rematchRoom(roomId: string): Promise<DuelRoomState>;
  leaveRoom(roomId: string): Promise<void>;
}

export interface DuelActor {
  readonly userId: string;
  readonly emailVerified: boolean;
}

const TOPIC = /^[A-Za-z]{2,24}$/;
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
  if (message.includes("duel_topic_not_found")) {
    return failure("TOPIC_NOT_FOUND" as const, "That topic has no reward to claim.");
  }
  if (message.includes("duel_topic_incomplete")) {
    return failure(
      "TOPIC_INCOMPLETE" as const,
      "Finish every achievement in this topic first. Progress counts this month only.",
    );
  }
  if (message.includes("duel_reward_not_eligible")) {
    return failure(
      "REWARD_NOT_ELIGIBLE" as const,
      "Free requests go to institution-verified hunters. Verify your institution to claim it.",
    );
  }
  if (message.includes("duel_room_not_found")) {
    return failure(
      "ROOM_NOT_FOUND" as const,
      "That room was not found. Check the code or open a new room.",
    );
  }
  if (message.includes("duel_room_unavailable")) {
    return failure(
      "ROOM_UNAVAILABLE" as const,
      "That room is no longer open: someone else joined, or the host left.",
    );
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
      const [record, opponents, achievements] = await Promise.all([
        this.repository.record(),
        this.repository.opponents(),
        // Achievements are a side table: the Duel still opens without them.
        this.repository.achievements().catch(() => null),
      ]);
      return success({ record, opponents, achievements });
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

  async claimTopic(actor: DuelActor | null, topic: string): Promise<ClaimDuelTopicResult> {
    const refused = this.guard(actor);
    if (refused) return refused;
    if (!TOPIC.test(topic)) {
      return failure("TOPIC_NOT_FOUND", "That topic has no reward to claim.");
    }
    try {
      return success({ outcome: await this.repository.claimTopic(topic) });
    } catch (error) {
      return refusal(error);
    }
  }

  /** The front page's top three. Anyone who may see the Hunters may see it. */
  async leaderboard(actor: DuelActor | null): Promise<DuelLeaderboardResult> {
    const refused = this.guard(actor);
    if (refused) return refused;
    try {
      return success(await this.repository.leaderboard());
    } catch (error) {
      return refusal(error);
    }
  }

  /** Runs a room operation for a signed-in member, mapping refusals to sentences. */
  private async room<T>(
    actor: DuelActor | null,
    operation: () => Promise<T>,
  ): Promise<{ ok: true; data: T } | Extract<DuelRoomResultEnvelope, { ok: false }>> {
    const refused = this.guard(actor);
    if (refused) return refused;
    try {
      return success(await operation());
    } catch (error) {
      return refusal(error);
    }
  }

  openRoom(actor: DuelActor | null): Promise<DuelRoomResultEnvelope> {
    return this.room(actor, () => this.repository.openRoom());
  }

  openRooms(actor: DuelActor | null): Promise<DuelOpenRoomsResult> {
    return this.room(actor, () => this.repository.openRooms());
  }

  async joinRoom(actor: DuelActor | null, input: unknown): Promise<DuelRoomResultEnvelope> {
    const parsed = joinDuelRoomInputSchema.safeParse(input);
    if (actor && !parsed.success) {
      return failure("VALIDATION_ERROR", "Room codes are 6 letters and numbers.");
    }
    return this.room(actor, () => this.repository.joinRoom(parsed.data?.code.toUpperCase() ?? ""));
  }

  async roomState(actor: DuelActor | null, roomId: string): Promise<DuelRoomResultEnvelope> {
    if (actor && !UUID.test(roomId)) return failure("ROOM_NOT_FOUND", "That room was not found.");
    return this.room(actor, () => this.repository.roomState(roomId));
  }

  async roomShot(
    actor: DuelActor | null,
    roomId: string,
    input: unknown,
  ): Promise<DuelRoomResultEnvelope> {
    const parsed = duelRoomShotInputSchema.safeParse(input);
    if (
      actor &&
      (!UUID.test(roomId) ||
        !parsed.success ||
        (!parsed.data.foul && parsed.data.reactionMs === null))
    ) {
      return failure("VALIDATION_ERROR", "That shot could not be recorded.");
    }
    return this.room(actor, () =>
      this.repository.roomShot(
        roomId,
        parsed.data?.roundNumber ?? 0,
        parsed.data?.reactionMs ?? null,
        parsed.data?.foul ?? false,
      ),
    );
  }

  async rematchRoom(actor: DuelActor | null, roomId: string): Promise<DuelRoomResultEnvelope> {
    if (actor && !UUID.test(roomId)) return failure("ROOM_NOT_FOUND", "That room was not found.");
    return this.room(actor, () => this.repository.rematchRoom(roomId));
  }

  async leaveRoom(actor: DuelActor | null, roomId: string): Promise<LeaveDuelRoomResult> {
    if (actor && !UUID.test(roomId)) return failure("ROOM_NOT_FOUND", "That room was not found.");
    return this.room(actor, async () => {
      await this.repository.leaveRoom(roomId);
      return { left: true as const };
    });
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
