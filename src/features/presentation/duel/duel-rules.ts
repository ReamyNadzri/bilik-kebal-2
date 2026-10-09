import {
  DUEL_DRAW_WINDOW_MS,
  DUEL_MAX_FOULS,
  DUEL_MAX_REACTION_MS,
  DUEL_MIN_REACTION_MS,
  type DuelOutcome,
} from "@/contracts/duel";

/**
 * The rules of one standoff, as the browser plays it out. The database decides
 * the recorded outcome of a duel from the same numbers (migration
 * 202610210001); these rules only drive what is drawn, and agree with it.
 *
 * Times are milliseconds since the standoff began; `signalAt` is when SHOOT!
 * appears and reactions are measured from it.
 */
export interface Round {
  readonly startedAt: number;
  readonly signalAt: number;
  /** When the opponent fires, after the signal. A practice target's is its target time. */
  readonly opponentMs: number;
  readonly practice: boolean;
  winner: "you" | "opp" | "draw" | null;
  /** When the deciding shot was fired, since the standoff began. */
  shotAt: number | null;
  /** The member's reaction when it decided the round. */
  you: number | null;
  /** A reaction pressed after the opponent had already won. */
  lateYou: number | null;
  foul: boolean;
  /** A first foul: the gun is dropped and the standoff restarts. */
  foulRetry: boolean;
  foulAt: number | null;
  pressAt: number | null;
}

export function newRound(
  startedAt: number,
  practice: boolean,
  opponentMs: number,
  random: () => number = Math.random,
): Round {
  return {
    startedAt,
    signalAt: signalDelay(practice, random),
    opponentMs,
    practice,
    winner: null,
    shotAt: null,
    you: null,
    lateYou: null,
    foul: false,
    foulRetry: false,
    foulAt: null,
    pressAt: null,
  };
}

/** The random wait before SHOOT!: 2.8–9.3 s in a duel, 2.2–7.2 s on the practice field. */
export function signalDelay(practice: boolean, random: () => number = Math.random): number {
  return practice ? 2200 + random() * 5000 : 2800 + random() * 6500;
}

/** Duels allow a draw window; the practice field has none. */
const drawWindow = (round: Round) => (round.practice ? 0 : DUEL_DRAW_WINDOW_MS);

export type PressEffect = "ignored" | "late" | "foul" | "foul-out" | "win" | "draw";

/**
 * Space or a tap at `t`. `foulsBefore` counts this duel's earlier fouls.
 *
 * A press before the signal, or sooner after it than any human can react, is
 * a foul: the first drops the gun, the second loses the duel.
 */
export function press(round: Round, t: number, foulsBefore: number): PressEffect {
  if (round.winner) {
    if (round.winner === "opp" && !round.foul && round.lateYou === null && t >= round.signalAt) {
      round.lateYou = t - round.signalAt;
      return "late";
    }
    return "ignored";
  }
  if (round.foulRetry) return "ignored";
  if (t < round.signalAt + DUEL_MIN_REACTION_MS) {
    round.foul = true;
    round.pressAt = t;
    if (foulsBefore + 1 < DUEL_MAX_FOULS) {
      round.foulRetry = true;
      round.foulAt = t;
      return "foul";
    }
    round.winner = "opp";
    round.shotAt = t + 320;
    return "foul-out";
  }
  const you = t - round.signalAt;
  round.you = you;
  if (you < round.opponentMs - drawWindow(round)) {
    round.winner = "you";
    round.shotAt = t;
    return "win";
  }
  if (you <= round.opponentMs + drawWindow(round)) {
    round.winner = "draw";
    round.shotAt = t;
    return "draw";
  }
  // Slower than the opponent: the timeout below decides it this same frame.
  round.you = null;
  round.lateYou = you;
  round.winner = "opp";
  round.shotAt = round.signalAt + round.opponentMs;
  return "late";
}

/** The opponent fires once the member has had their chance. True when that decided it now. */
export function timeout(round: Round, t: number): boolean {
  if (round.winner || round.foulRetry) return false;
  if (t < round.signalAt + round.opponentMs + drawWindow(round)) return false;
  round.winner = "opp";
  round.shotAt = round.signalAt + round.opponentMs;
  return true;
}

/** The member's reaction to record: the deciding one, or a late one; never a foul's. */
export function recordedReaction(round: Round): number | null {
  if (round.foul && round.winner === "opp") return null;
  const ms = round.winner === "you" || round.winner === "draw" ? round.you : round.lateYou;
  if (ms === null) return null;
  const rounded = Math.round(ms);
  return rounded >= DUEL_MIN_REACTION_MS && rounded <= DUEL_MAX_REACTION_MS ? rounded : null;
}

/** The outcome as the database will decide it. */
export function outcomeOf(round: Round): DuelOutcome {
  return round.winner === "you" ? "win" : round.winner === "draw" ? "draw" : "lose";
}

/** The heartbeat's interval: 1 s at first, tightening to 330 ms as the wait grows. */
export function heartbeatInterval(t: number): number {
  return Math.max(330, 1000 - (t - 900) * 0.11);
}

export type Rank = "DEADEYE" | "GUNSLINGER" | "GREENHORN";

/** A ghost's rank by their average draw. */
export function rankOf(averageMs: number): Rank {
  return averageMs <= 265 ? "DEADEYE" : averageMs <= 335 ? "GUNSLINGER" : "GREENHORN";
}

export interface Tally {
  readonly kills: number;
  readonly deaths: number;
}

/** Kills per death, two decimals; kills alone before the first death. */
export function killDeathRatio({ kills, deaths }: Tally): string {
  return (deaths ? kills / deaths : kills).toFixed(2);
}

/** The share of decided duels won; draws are left out. */
export function winRate({ kills, deaths }: Tally): string {
  return kills + deaths ? `${Math.round((kills / (kills + deaths)) * 100)}%` : "—";
}

export const formatMs = (ms: number | null | undefined) =>
  ms === null || ms === undefined ? "—" : `${Math.round(ms)} ms`;

export type ResultTone = "win" | "lose" | "draw";

export interface ResultCopy {
  readonly title: string;
  readonly tone: ResultTone;
  readonly line: string;
  readonly you: string;
  readonly them: string;
}

/** The result card's words for a finished duel. */
export function duelResultCopy(round: Round, opponentName: string): ResultCopy {
  const late = round.lateYou;
  if (round.winner === "draw") {
    return {
      title: "DRAW",
      tone: "draw",
      line: "You both fired at the same moment. Both hunters fall.",
      you: formatMs(round.you),
      them: formatMs(round.opponentMs),
    };
  }
  if (round.winner === "you") {
    return {
      title: "YOU WIN",
      tone: "win",
      line: `${opponentName} is eliminated.`,
      you: formatMs(round.you),
      them: formatMs(round.opponentMs),
    };
  }
  if (round.foul) {
    return {
      title: "ELIMINATED",
      tone: "lose",
      line: "Two fouls. You drew before the signal twice.",
      you: "Foul ×2",
      them: "—",
    };
  }
  return {
    title: "ELIMINATED",
    tone: "lose",
    line: `${opponentName} drew first.`,
    you: late === null ? "No shot" : formatMs(late),
    them: formatMs(round.opponentMs),
  };
}

/** The result card's words for a practice shot. */
export function practiceResultCopy(round: Round): ResultCopy {
  const target = round.opponentMs;
  if (round.winner === "you") {
    return {
      title: "HIT",
      tone: "win",
      line: `Under the ${target} ms target.`,
      you: formatMs(round.you),
      them: `${target} ms`,
    };
  }
  if (round.foul) {
    return {
      title: "TOO EARLY",
      tone: "lose",
      line: "You drew before the signal.",
      you: "Too early",
      them: `${target} ms`,
    };
  }
  return {
    title: "TOO SLOW",
    tone: "lose",
    line: `The target is ${target} ms.`,
    you: round.lateYou === null ? "No shot" : formatMs(round.lateYou),
    them: `${target} ms`,
  };
}
