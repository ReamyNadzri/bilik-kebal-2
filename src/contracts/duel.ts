import { z } from "zod";
import type { OperationResult } from "./operation-result";

/**
 * The Duel: a quick-draw minigame against other members' ghosts
 * (migration 202610210001, design_handoff_vaultix_duel).
 *
 * A ghost is a member who has played. It shoots at a time the database draws
 * from that member's real average reaction, never faster than their real
 * fastest, and the database decides every round. The browser measures only
 * the member's own reaction.
 */

/** No human reacts faster; a press sooner after the signal is a guess, and a foul. */
export const DUEL_MIN_REACTION_MS = 100;
/** A press later than this after the signal is not recorded as a reaction. */
export const DUEL_MAX_REACTION_MS = 5000;
/** Both shots within this many milliseconds of each other is a draw. */
export const DUEL_DRAW_WINDOW_MS = 15;
/** Clean shots a member needs before their ghost can be challenged. */
export const DUEL_GHOST_MIN_SHOTS = 5;
/** The second foul in one duel loses it. */
export const DUEL_MAX_FOULS = 2;

export const DUEL_PRACTICE_LEVELS = [
  { id: "easy", name: "Easy", targetMs: 700 },
  { id: "normal", name: "Normal", targetMs: 480 },
  { id: "hard", name: "Hard", targetMs: 350 },
  { id: "deadeye", name: "Deadeye", targetMs: 270 },
  { id: "legend", name: "Legend", targetMs: 210 },
] as const;
export type DuelPracticeLevel = (typeof DUEL_PRACTICE_LEVELS)[number]["id"];
const LEVEL_IDS = DUEL_PRACTICE_LEVELS.map((level) => level.id) as [
  DuelPracticeLevel,
  ...DuelPracticeLevel[],
];

const reaction = z.number().int().min(DUEL_MIN_REACTION_MS).max(DUEL_MAX_REACTION_MS).nullable();

export const startDuelInputSchema = z.object({ opponentPublicId: z.string().uuid() });
export const finishDuelInputSchema = z.object({
  reactionMs: reaction,
  fouls: z.number().int().min(0).max(DUEL_MAX_FOULS),
});
export const duelPracticeInputSchema = z.object({
  level: z.enum(LEVEL_IDS),
  reactionMs: reaction,
  foul: z.boolean(),
});
export const duelListingInputSchema = z.object({ listed: z.boolean() });

export type DuelOutcome = "win" | "lose" | "draw";

export interface DuelHistoryItem {
  opponentName: string;
  opponentPublicId: string;
  outcome: DuelOutcome;
  /** Null when the member never fired, or fouled twice. */
  youMs: number | null;
  /** Null when an online opponent never fired, or fouled out. */
  themMs: number | null;
  fouls: number;
  at: string;
}

export interface DuelPracticeStats {
  tries: number;
  hits: number;
  bestMs: number | null;
  averageMs: number | null;
}

export interface DuelRecord {
  kills: number;
  deaths: number;
  draws: number;
  /** Fastest and average clean reaction, duels and practice together. */
  bestMs: number | null;
  averageMs: number | null;
  /** Clean reactions recorded; the ghost is listed from `DUEL_GHOST_MIN_SHOTS`. */
  shots: number;
  /** Whether other members may duel this member's ghost. */
  listed: boolean;
  /** The last six duels, newest first. */
  history: DuelHistoryItem[];
  practice: Partial<Record<DuelPracticeLevel, DuelPracticeStats>>;
}

export interface DuelOpponent {
  publicId: string;
  displayName: string;
  avatarUrl: string | null;
  institutionName: string | null;
  averageMs: number;
  bestMs: number;
  /** The viewer's own record against this ghost. */
  wins: number;
  losses: number;
  draws: number;
}

/**
 * One of the 50 monthly achievements (migration 202610210002). Progress is
 * worked out by the database from this month's own duels and practice shots
 * (Malaysia time), so it resets on the first of every month.
 */
export interface DuelAchievement {
  id: string;
  /** 1 to 50: its place in the catalogue, and its badge (`/duel/badges/NN.webp`). */
  number: number;
  category: string;
  title: string;
  description: string;
  target: number;
  /** Capped at the target. */
  progress: number;
  done: boolean;
  /** Retired by migration 202610210003: topics give the rewards now. Always false. */
  grantsFreeRequest: boolean;
  claimed: boolean;
}

/**
 * One of the 7 topics the achievements are grouped in. Finishing every
 * achievement of a topic in a month lets an institution-verified member claim
 * `topicCredits` free requests, which expire one month after the claim.
 */
export interface DuelTopic {
  category: string;
  total: number;
  done: number;
  /** Claimed this month. */
  claimed: boolean;
  /** When this month's claimed free requests expire; null until claimed. */
  expiresAt: string | null;
}

export interface DuelAchievements {
  /** `YYYY-MM`, Malaysia time. */
  month: string;
  /** When this month's progress starts again from zero. */
  resetsAt: string;
  /** Institution verified and not restricted: may claim the free requests. */
  rewardEligible: boolean;
  /** Free requests a finished topic gives. */
  topicCredits: number;
  items: DuelAchievement[];
  topics: DuelTopic[];
}

export interface DuelLobby {
  record: DuelRecord;
  opponents: DuelOpponent[];
  /** Null when this month's achievements could not be read; the rest of the Duel still works. */
  achievements: DuelAchievements | null;
}

/** A place on the front page's top three: all-time K/D, from 10 duels up. */
export interface DuelLeader {
  publicId: string;
  displayName: string;
  avatarUrl: string | null;
  kills: number;
  deaths: number;
  draws: number;
}

/** Duels a member needs before they can appear on the leaderboard. */
export const DUEL_LEADERBOARD_MIN_DUELS = 10;

export interface DuelRoundStart {
  roundId: string;
  /** When the ghost fires, in milliseconds after the signal. */
  opponentMs: number;
}

export interface DuelRoundResult {
  outcome: DuelOutcome;
  youMs: number | null;
  themMs: number;
  fouls: number;
  kills: number;
  deaths: number;
  draws: number;
}

export interface DuelPracticeResult {
  hit: boolean;
  targetMs: number;
  youMs: number | null;
}

/**
 * Online duels (migration 202610210004). A member opens a room; another joins
 * it from the lobby or by its link, and the duel starts. The database decides
 * when the standoff starts, when SHOOT! shows and who won; each browser maps
 * those moments onto its own clock with `serverNow`.
 */
export const DUEL_ROOM_CODE = /^[A-HJ-NP-Za-hj-np-z2-9]{6}$/;

export const joinDuelRoomInputSchema = z.object({
  code: z.string().trim().regex(DUEL_ROOM_CODE),
});
export const duelRoomShotInputSchema = z.object({
  roundNumber: z.number().int().min(1),
  reactionMs: reaction,
  foul: z.boolean(),
});

export interface DuelRoomPerson {
  publicId: string;
  displayName: string;
  avatarUrl: string | null;
  averageMs: number | null;
}

export interface DuelOpenRoom {
  code: string;
  openedAt: string;
  host: DuelRoomPerson;
}

export interface DuelRoomRound {
  /** Counts up each time a foul restarts the duel. */
  number: number;
  /** When the standoff starts and when SHOOT! shows, on the server's clock. */
  startsAt: string;
  signalAt: string;
  yourFouls: number;
  theirFouls: number;
  youShot: boolean;
  theyShot: boolean;
  /** Who caused the latest restart. */
  lastFoul: "you" | "them" | null;
}

export interface DuelRoomResult {
  outcome: DuelOutcome;
  reason: "shots" | "fouls" | "left" | "no_shots";
  youMs: number | null;
  themMs: number | null;
  yourFouls: number;
  theirFouls: number;
  kills: number;
  deaths: number;
  draws: number;
}

export interface DuelRoomState {
  roomId: string;
  code: string;
  status: "open" | "playing" | "finished" | "closed";
  role: "host" | "guest";
  opponent: DuelRoomPerson | null;
  duelNo: number;
  round: DuelRoomRound | null;
  /** The current duel's result, once decided. */
  result: DuelRoomResult | null;
  rematch: { you: boolean; them: boolean };
  /** The server's clock when this was read, in ms since the epoch. */
  serverNow: number;
}

export type DuelOperationCode =
  | "AUTH_REQUIRED"
  | "EMAIL_NOT_VERIFIED"
  | "VALIDATION_ERROR"
  | "OPPONENT_UNAVAILABLE"
  | "TOO_SOON"
  | "ROUND_NOT_FOUND"
  | "ROUND_EXPIRED"
  | "TOPIC_NOT_FOUND"
  | "TOPIC_INCOMPLETE"
  | "REWARD_NOT_ELIGIBLE"
  | "ROOM_NOT_FOUND"
  | "ROOM_UNAVAILABLE"
  | "DUEL_UNAVAILABLE";

export type DuelLobbyResult = OperationResult<DuelLobby, DuelOperationCode>;
export type StartDuelResult = OperationResult<DuelRoundStart, DuelOperationCode>;
export type FinishDuelResult = OperationResult<DuelRoundResult, DuelOperationCode>;
export type DuelPracticeShotResult = OperationResult<DuelPracticeResult, DuelOperationCode>;
export type DuelListingResult = OperationResult<{ listed: boolean }, DuelOperationCode>;
export type ResetDuelRecordResult = OperationResult<{ reset: true }, DuelOperationCode>;
export type ClaimDuelTopicResult = OperationResult<
  { outcome: "claimed" | "already_claimed" },
  DuelOperationCode
>;
export type DuelLeaderboardResult = OperationResult<DuelLeader[], DuelOperationCode>;
export type DuelRoomResultEnvelope = OperationResult<DuelRoomState, DuelOperationCode>;
export type DuelOpenRoomsResult = OperationResult<DuelOpenRoom[], DuelOperationCode>;
export type LeaveDuelRoomResult = OperationResult<{ left: true }, DuelOperationCode>;
