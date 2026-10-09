import {
  BAYER,
  COL,
  H,
  OTS,
  W,
  buildStreet,
  clamp01,
  cowboyBack,
  cowboyFront,
  drawBloodSplats,
  easeOut,
  fitCanvas,
  flashAt,
  flattenLayer,
  hash,
  hatFront,
  lerp,
  puff,
  revolverSide,
  type Pt,
} from "./duel-art";
import type { DuelRoomResult } from "@/contracts/duel";
import type { DuelAudio } from "./duel-audio";
import { pixelPicture, scenePicture } from "./duel-pictures";
import {
  duelResultCopy,
  heartbeatInterval,
  newOnlineRound,
  newRound,
  onlineResultCopy,
  practiceResultCopy,
  press,
  recordedReaction,
  resolveOnline,
  timeout,
  type ResultCopy,
  type Round,
} from "./duel-rules";

/**
 * The Duel's game loop: the VS intro, the standoff, the shot and the reveal,
 * drawn on one canvas, with the DOM text over it updated in place.
 *
 * Ported from the designer's prototype (design_handoff_vaultix_duel); its
 * timings are the handoff's. It knows nothing of accounts or the network:
 * the page hands it the opponent's time and is told when the round is decided.
 */

export interface StageElements {
  readonly canvas: HTMLCanvasElement;
  readonly nameTop: HTMLElement;
  readonly nameBottom: HTMLElement;
  readonly vs: HTMLElement;
  readonly dialog: HTMLElement;
  readonly dialogText: HTMLElement;
  readonly message: HTMLElement;
  readonly timer: HTMLElement;
  readonly hint: HTMLElement;
}

export interface Fighter {
  readonly name: string;
  readonly pictureUrl: string | null;
}

/** When the opponent fires, in ms after the signal; resolves an error message to abort. */
export type Ticket = Promise<{ ok: true; opponentMs: number } | { ok: false; message: string }>;

export type Match =
  | { readonly kind: "duel"; readonly opponent: Fighter; readonly ticket: Ticket }
  | { readonly kind: "practice"; readonly name: string; readonly targetMs: number }
  /** Another member, live: the server times every round and decides it. */
  | { readonly kind: "online"; readonly opponent: Fighter };

/** One online round, already mapped onto this page's clock (`performance.now()`). */
export interface OnlineRoundPlan {
  readonly number: number;
  readonly startAt: number;
  /** SHOOT! shows this long after `startAt`. */
  readonly signalDelay: number;
  readonly yourFouls: number;
  /** Who caused this restart, if a foul did. */
  readonly lastFoul: "you" | "them" | null;
}

export interface OnlineShot {
  readonly roundNumber: number;
  /** Ms from this page's SHOOT! to the press; null for a foul. */
  readonly reactionMs: number | null;
  readonly foul: boolean;
}

export interface Decision {
  /** The reaction the database should record, or null. */
  readonly reactionMs: number | null;
  readonly fouls: number;
  readonly round: Round;
}

export interface EngineCallbacks {
  readonly onStandoff: () => void;
  /** The round is decided for good; called once per match. */
  readonly onDecided: (decision: Decision) => void;
  readonly onResult: (copy: ResultCopy) => void;
  readonly onAbort: (message: string) => void;
  /** Online: the member fired, or fouled; the page sends it to the server. */
  readonly onOnlineShot?: (shot: OnlineShot) => void;
}

type Phase = "idle" | "intro" | "standoff" | "result";

const INK = "#0d0805";
const CREAM = "#f7ecd2";
const SHOOT_RED = "#ff5a43";
const GOLD = "#f3c977";
/** The pause between the shot and the reveal, both fighters frozen. */
const REVEAL_DELAY = 650;
/** The visual draw before a winning shot; the reaction was measured at the press. */
const DRAW_ANIMATION = 120;

function setOpacity(el: HTMLElement | undefined, opacity: number, transform?: string) {
  if (!el) return;
  el.style.opacity = String(opacity);
  if (transform !== undefined) el.style.transform = transform;
}

function setText(el: HTMLElement | undefined, text: string, color?: string) {
  if (!el) return;
  if (el.textContent !== text) el.textContent = text;
  if (color && el.style.color !== color) el.style.color = color;
}

/**
 * A sprite with an ink outline `px` image pixels wide, so the straw dummy
 * stands out from the dusty street behind it.
 */
function outlineSprite(im: HTMLImageElement, px: number): HTMLCanvasElement {
  const w = im.naturalWidth + px * 2;
  const h = im.naturalHeight + px * 2;
  const silhouette = document.createElement("canvas");
  silhouette.width = w;
  silhouette.height = h;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const s = silhouette.getContext("2d");
  const o = out.getContext("2d");
  if (!s || !o) return out;
  s.drawImage(im, px, px);
  s.globalCompositeOperation = "source-in";
  s.fillStyle = INK;
  s.fillRect(0, 0, w, h);
  o.imageSmoothingEnabled = false;
  for (let dx = -px; dx <= px; dx += 1) {
    for (let dy = -px; dy <= px; dy += 1) {
      if (dx * dx + dy * dy <= px * px + 1) o.drawImage(silhouette, dx, dy);
    }
  }
  o.drawImage(im, px, px);
  return out;
}

function layer(): CanvasRenderingContext2D | null {
  const c = document.createElement("canvas");
  c.width = W * 2;
  c.height = H * 2;
  return c.getContext("2d", { willReadFrequently: true });
}

export class DuelEngine {
  private elements: StageElements | null = null;
  private phase: Phase = "idle";
  private match: Match | null = null;
  private raf = 0;

  private introStart = 0;
  private introTypedAt: number | null = null;
  private introEnd: number | null = null;
  private vsCue = false;
  private opponentMs: number | null = null;
  private ticketFailed: string | null = null;

  private round: Round | null = null;
  private fouls = 0;
  private decided = false;
  private resultAt = 0;
  private cues = new Set<string>();
  private nextBeat: number | null = null;
  private lastBeat: number | null = null;
  private dropFrom: Pt | null = null;
  private plan: OnlineRoundPlan | null = null;
  private roundNumber = 0;
  private notice: string | null = null;
  private onlineResult: DuelRoomResult | null = null;
  /** The timer line under a notice that stops a round. */
  private noticeTimer = "";
  /** Online: when a round nobody fired in shows its result card. */
  private finishAt: number | null = null;
  private lastHand: Pt = [OTS.me.x, OTS.me.y];

  private street: HTMLCanvasElement = buildStreet();
  private introBackdrop: HTMLCanvasElement | null = null;
  private dummy: HTMLCanvasElement | null = null;
  private faces: Record<"meFace" | "meBust" | "oppFace" | "oppBust", HTMLCanvasElement | null> = {
    meFace: null,
    meBust: null,
    oppFace: null,
    oppBust: null,
  };
  private layers: { S: CanvasRenderingContext2D; L: CanvasRenderingContext2D } | null = null;

  constructor(
    private readonly audio: DuelAudio,
    private readonly callbacks: EngineCallbacks,
    private readonly reducedMotion: boolean,
  ) {
    void scenePicture("/duel/street.png").then((im) => {
      if (im) this.street = fitCanvas(im);
    });
    void scenePicture("/duel/intro.png").then((im) => {
      if (im) this.introBackdrop = fitCanvas(im);
    });
    void scenePicture("/duel/dummy.png").then((im) => {
      if (im) this.dummy = outlineSprite(im, 2);
    });
  }

  attach(elements: StageElements | null): void {
    this.elements = elements;
  }

  /** The member's own picture, for their face and their banner. */
  setPlayer(player: Fighter): void {
    void pixelPicture(player.pictureUrl, 64, "face").then((c) => (this.faces.meFace = c));
    void pixelPicture(player.pictureUrl, 88, "bust").then((c) => (this.faces.meBust = c));
  }

  get inResult(): boolean {
    return this.phase === "result" && performance.now() > this.resultAt;
  }

  /** Begins a match with its intro. Practice skips straight to the dialog. */
  start(match: Match): void {
    this.match = match;
    this.round = null;
    this.fouls = 0;
    this.decided = false;
    this.introEnd = null;
    this.introTypedAt = null;
    this.ticketFailed = null;
    this.plan = null;
    this.roundNumber = 0;
    this.notice = null;
    this.onlineResult = null;
    this.finishAt = null;
    this.opponentMs = match.kind === "practice" ? match.targetMs : null;
    this.faces.oppFace = null;
    this.faces.oppBust = null;
    if (match.kind === "online") {
      // The intro plays until the server's start time; nothing in it can skip ahead.
      this.introStart = performance.now();
      this.vsCue = false;
      this.audio.cue("intro");
      void pixelPicture(match.opponent.pictureUrl, 18, "face").then(
        (c) => (this.faces.oppFace = c),
      );
      void pixelPicture(match.opponent.pictureUrl, 88, "bust").then(
        (c) => (this.faces.oppBust = c),
      );
    } else if (match.kind === "duel") {
      this.introStart = performance.now();
      this.vsCue = false;
      this.audio.cue("intro");
      void pixelPicture(match.opponent.pictureUrl, 18, "face").then(
        (c) => (this.faces.oppFace = c),
      );
      void pixelPicture(match.opponent.pictureUrl, 88, "bust").then(
        (c) => (this.faces.oppBust = c),
      );
      void match.ticket.then((ticket) => {
        if (this.match !== match) return;
        if (ticket.ok) this.opponentMs = ticket.opponentMs;
        else this.ticketFailed = ticket.message;
      });
    } else {
      this.introStart = performance.now() - 2950;
      this.vsCue = true;
    }
    this.phase = "intro";
    cancelAnimationFrame(this.raf);
    const tick = (now: number) => {
      this.raf = requestAnimationFrame(tick);
      this.frame(now);
    };
    this.raf = requestAnimationFrame(tick);
  }

  /** Space or a tap on the stage. */
  press(): void {
    if (this.phase === "intro") {
      if (this.match?.kind !== "online") this.confirmIntro();
    } else if (this.phase === "standoff") this.pressStandoff();
  }

  /**
   * Online: the server's timing for a round. The first round starts the
   * standoff when its time comes; a later one is a restart after a foul.
   */
  scheduleRound(plan: OnlineRoundPlan): void {
    if (this.match?.kind !== "online" || plan.number <= this.roundNumber) return;
    if (this.plan?.number === plan.number) return;
    this.plan = plan;
    const round = this.round;
    if (round && plan.lastFoul === "them" && !round.winner) {
      round.halted = true;
      this.notice = "THEY DREW EARLY!";
      this.noticeTimer = "They dropped their gun. One more chance…";
    }
  }

  /** Online: the server's decision, played out from now. */
  resolve(result: DuelRoomResult): void {
    const round = this.round;
    if (this.match?.kind !== "online" || !round || this.onlineResult) return;
    this.onlineResult = result;
    if (result.reason === "no_shots") {
      // Nobody fired: nobody falls.
      round.halted = true;
      this.notice = "NO SHOT FIRED";
      this.noticeTimer = "";
      this.finishAt = performance.now() + 1200;
      return;
    }
    this.notice = null;
    round.halted = false;
    resolveOnline(round, performance.now() - round.startedAt, result);
  }

  private beginOnlineRound(plan: OnlineRoundPlan) {
    this.round = newOnlineRound(plan.startAt, plan.signalDelay);
    this.roundNumber = plan.number;
    this.fouls = plan.yourFouls;
    this.plan = null;
    this.notice = null;
    this.finishAt = null;
    this.cues = new Set();
    this.nextBeat = null;
    this.lastBeat = null;
    this.dropFrom = null;
    if (this.phase !== "standoff") {
      this.phase = "standoff";
      this.callbacks.onStandoff();
    }
  }

  /**
   * Stops the loop. Returns the decision not yet reported, if the member
   * leaves after the round was decided, so leaving cannot dodge a loss.
   */
  stop(): Decision | null {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.audio.cancelSpeech();
    const pending = this.pendingDecision();
    this.phase = "idle";
    this.match = null;
    this.round = null;
    return pending;
  }

  private pendingDecision(): Decision | null {
    if (this.match?.kind === "online") return null;
    const round = this.round;
    if (!round?.winner || this.decided || round.foulRetry) return null;
    this.decided = true;
    return { reactionMs: recordedReaction(round), fouls: this.fouls, round };
  }

  private decide(): void {
    const decision = this.pendingDecision();
    if (decision) this.callbacks.onDecided(decision);
  }

  private confirmIntro() {
    const t = performance.now() - this.introStart;
    if (this.introTypedAt === null) {
      if (t < 2700) this.introStart = performance.now() - 2700;
      return;
    }
    if (this.introEnd !== null && this.introEnd - t <= 450) return;
    if (t < this.introTypedAt) {
      this.introStart = performance.now() - this.introTypedAt;
      return;
    }
    this.introEnd = t + 450;
  }

  private beginStandoff(now: number) {
    const match = this.match;
    if (!match || this.opponentMs === null) return;
    this.round = newRound(now, match.kind === "practice", this.opponentMs);
    this.cues = new Set();
    this.nextBeat = null;
    this.lastBeat = null;
    this.dropFrom = null;
    this.phase = "standoff";
    this.callbacks.onStandoff();
  }

  private pressStandoff() {
    const round = this.round;
    if (!round) return;
    const t = performance.now() - round.startedAt;
    const effect = press(round, t, this.fouls);
    if (effect === "foul" || effect === "foul-out") {
      this.fouls += 1;
      this.audio.cue("foul");
    }
    if (round.online) {
      if (effect === "foul" || effect === "foul-out") {
        this.callbacks.onOnlineShot?.({
          roundNumber: this.roundNumber,
          reactionMs: null,
          foul: true,
        });
      } else if (effect === "shot" && round.you !== null && round.you <= 5000) {
        this.callbacks.onOnlineShot?.({
          roundNumber: this.roundNumber,
          reactionMs: Math.max(100, Math.round(round.you)),
          foul: false,
        });
      }
      return;
    }
    // A duel lost on time waits for a late press; anything else is final now.
    if (effect === "win" || effect === "draw" || effect === "foul-out") this.decide();
  }

  private finish() {
    const round = this.round;
    const match = this.match;
    if (!round || !match) return;
    this.decide();
    const won = round.winner === "you";
    this.audio.cue(won ? "win" : "lose");
    this.resultAt = performance.now() + 350;
    this.phase = "result";
    this.callbacks.onResult(
      match.kind === "practice"
        ? practiceResultCopy(round)
        : match.kind === "online" && this.onlineResult
          ? onlineResultCopy(this.onlineResult, match.opponent.name)
          : duelResultCopy(round, match.opponent.name),
    );
  }

  private frame(now: number) {
    const el = this.elements;
    const canvas = el?.canvas;
    if (!el || !canvas) return;
    const x = canvas.getContext("2d");
    if (!x) return;
    x.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    x.imageSmoothingEnabled = false;

    if (this.finishAt !== null && now >= this.finishAt && this.phase === "standoff") {
      this.finishAt = null;
      this.finish();
    }

    // Online, every round begins at the server's moment, whatever is on screen.
    if (this.match?.kind === "online" && this.plan && now >= this.plan.startAt) {
      setOpacity(el.dialog, 0);
      this.beginOnlineRound(this.plan);
    }

    if (this.phase === "intro") {
      const t = now - this.introStart;
      if (this.ticketFailed !== null) {
        const message = this.ticketFailed;
        this.stop();
        this.callbacks.onAbort(message);
        return;
      }
      if (t >= 1700 && !this.vsCue) {
        this.vsCue = true;
        this.audio.cue("vs");
      }
      // The intro holds on its last frame until the database has drawn the opponent's time.
      if (this.introEnd !== null && t >= this.introEnd && this.opponentMs !== null) {
        setOpacity(el.dialog, 0);
        this.beginStandoff(now);
        return;
      }
      this.drawIntro(x, t, el);
      return;
    }

    setOpacity(el.nameTop, 0);
    setOpacity(el.nameBottom, 0);
    setOpacity(el.vs, 0);
    setOpacity(el.dialog, 0);
    const round = this.round;
    if (!round) return;
    const t = now - round.startedAt;
    if (round.online) {
      // The server restarts the round; see scheduleRound.
    } else if (round.foulRetry) {
      if (round.foulAt !== null && t >= round.foulAt + 2200) {
        this.beginStandoff(now);
        return;
      }
    } else {
      timeout(round, t);
    }
    const cue = (name: string) => {
      if (this.cues.has(name)) return false;
      this.cues.add(name);
      return true;
    };
    if (cue("ready")) {
      this.audio.cue("ready");
      this.audio.speak("ready");
    }
    if (t >= 2000 && t < round.signalAt - 400 && !round.foul && cue("steady")) {
      this.audio.cue("steady");
      this.audio.speak("steady");
    }
    if (t >= round.signalAt && !round.foulRetry && !round.halted && cue("signal")) {
      this.audio.cue("signal");
      if (!round.foul) this.audio.speak("shoot");
    }
    const practiceMiss = round.practice && round.winner === "opp";
    const visualDelay = round.winner === "you" || round.winner === "draw" ? DRAW_ANIMATION : 0;
    if (round.shotAt !== null && !practiceMiss && t >= round.shotAt + visualDelay && cue("fire")) {
      this.audio.cue("fire");
    }
    // The heartbeat, from 900 ms until the signal.
    if (!this.cues.has("signal") && !round.foul && !round.winner && !round.halted && t > 900) {
      this.nextBeat ??= t;
      if (t >= this.nextBeat) {
        this.lastBeat = t;
        this.nextBeat = t + heartbeatInterval(t);
        this.audio.heartbeat(clamp01((t - 900) / 6000));
      }
    }
    const pulse =
      this.lastBeat === null || this.cues.has("signal") || round.winner || round.halted
        ? 0
        : (Math.exp(-(t - this.lastBeat) / 130) +
            (t - this.lastBeat > 170 ? 0.7 * Math.exp(-(t - this.lastBeat - 170) / 120) : 0)) *
          (0.35 + 0.65 * clamp01((t - 900) / 6000));
    if (round.shotAt !== null && !practiceMiss) {
      const reveal = round.shotAt + visualDelay + REVEAL_DELAY;
      if (t >= reveal && cue("reveal")) this.audio.thud();
      if (t >= reveal + 440 && cue("fall")) this.audio.cue("fall");
    }
    if (this.phase === "standoff" && round.shotAt !== null) {
      if (t >= round.shotAt + visualDelay + REVEAL_DELAY + 1500) this.finish();
    }

    this.drawStandoff(x, t, round, pulse);

    let message = "";
    let color = CREAM;
    if (this.phase === "result") message = "";
    else if (round.halted && this.notice) {
      message = this.notice;
      color = GOLD;
    } else if (round.foulRetry) {
      message = "FOUL!";
      color = GOLD;
    } else if (round.foul) {
      message = "FOUL AGAIN!";
      color = SHOOT_RED;
    } else if (t < 1600) {
      message = this.fouls ? "LAST CHANCE" : "READY";
      if (this.fouls) color = GOLD;
    } else if (practiceMiss && round.shotAt !== null && t >= round.shotAt) {
      message = "TOO SLOW";
      color = GOLD;
    } else if (t >= round.signalAt && (round.shotAt === null || t < round.shotAt + 500)) {
      message = "SHOOT!";
      color = SHOOT_RED;
    } else if (t >= 2000 && t < Math.min(3400, round.signalAt)) {
      message = "STEADY…";
    }
    setText(el.message, message, color);

    let timer = "";
    if (round.foulRetry) timer = "You dropped your gun. One more chance…";
    if (round.halted) timer = this.noticeTimer;
    if (this.phase !== "result" && t >= round.signalAt && !round.foul && !round.halted) {
      const shown =
        round.winner === "you" || round.winner === "draw"
          ? round.you
          : round.winner === "opp"
            ? round.practice
              ? (round.lateYou ?? round.opponentMs)
              : round.opponentMs
            : round.you !== null
              ? round.you
              : t - round.signalAt;
      timer = `${Math.round(shown ?? 0)} ms`;
    }
    setText(el.timer, timer);
    setOpacity(
      el.hint,
      this.phase === "standoff" && !round.foul && !round.halted && t < round.signalAt ? 1 : 0,
    );
  }

  private drawIntro(x: CanvasRenderingContext2D, t: number, el: StageElements) {
    const f = (X: number, Y: number, w: number, h: number, c: string) => {
      x.fillStyle = c;
      x.fillRect(Math.round(X), Math.round(Y), w, h);
    };
    setText(el.message, "");
    setText(el.timer, "");
    setOpacity(el.hint, 0);
    if (t < 600) {
      // Kept under three flashes a second (WCAG 2.3.1), and still under reduced motion.
      f(0, 0, W, H, this.reducedMotion || Math.floor(t / 200) % 2 === 0 ? INK : CREAM);
      setOpacity(el.nameTop, 0);
      setOpacity(el.nameBottom, 0);
      setOpacity(el.vs, 0);
      setOpacity(el.dialog, 0);
      return;
    }
    if (t < 1100) {
      f(0, 0, W, H, CREAM);
      for (let i = 0; i < 8; i += 1) {
        const p = easeOut(clamp01((t - 600 - i * 35) / 260));
        const w = Math.ceil(p * W);
        if (i % 2) f(0, i * 18, w, 18, "#1b1109");
        else f(W - w, i * 18, w, 18, "#1b1109");
      }
      return;
    }
    f(0, 0, W, H, "#1b1109");
    if (this.introBackdrop) {
      x.globalAlpha = 0.55;
      x.drawImage(this.introBackdrop, 0, 0, W, H);
      x.globalAlpha = 1;
    }
    for (let k = 0; k < 26; k += 1) {
      const y = Math.floor(hash(k) * H);
      const len = 16 + hash(k + 3) * 40;
      const sx = W - ((t * 0.35 * (1 + hash(k + 9)) + hash(k + 5) * W) % (W + 60));
      f(sx, y, len, 1, "#3a2614");
    }
    const pt = easeOut(clamp01((t - 1100) / 380));
    const pb = easeOut(clamp01((t - 1250) / 380));
    const out = easeOut(clamp01((t - 2600) / 320));
    const ot = (1 - pt + out) * W;
    const ob = -(1 - pb + out) * W;
    for (let y = 14; y <= 62; y += 1) {
      const s = ot + 30 - (y - 14) / 2;
      f(
        s,
        y,
        W - s + 2,
        1,
        y === 14 || y === 62 ? "#c89b3c" : y === 15 || y === 61 ? INK : "#1f4d34",
      );
    }
    for (let k = 0; k < 8; k += 1) {
      const y = 18 + Math.floor(hash(k + 20) * 40);
      const sx = ot + W - ((t * 0.6 + hash(k + 30) * W) % (W + 40));
      f(sx, y, 18 + hash(k) * 20, 1, "#2f6a49");
    }
    for (let y = 82; y <= 130; y += 1) {
      const e = ob + W - 30 + (y - 82) / 2;
      f(
        ob - 2,
        y,
        e - ob + 2,
        1,
        y === 82 || y === 130 ? "#c89b3c" : y === 83 || y === 129 ? INK : "#9e2b25",
      );
    }
    for (let k = 0; k < 8; k += 1) {
      const y = 86 + Math.floor(hash(k + 40) * 40);
      const sx = ob + ((t * 0.6 + hash(k + 50) * W) % (W + 40)) - 40;
      f(sx, y, 18 + hash(k + 1) * 20, 1, "#c4453a");
    }
    const practice = this.match?.kind === "practice";
    const opp = practice ? null : this.faces.oppBust;
    if (opp) x.drawImage(opp, Math.round(W - 60 + ot), 17, 44, 44);
    else if (practice && this.dummy) x.drawImage(this.dummy, Math.round(W - 56 + ot), 17, 42, 44);
    if (this.faces.meBust) x.drawImage(this.faces.meBust, Math.round(16 + ob), 85, 44, 44);
    setOpacity(el.nameTop, pt, `translateX(${(1 - pt + out) * 100}cqw)`);
    setOpacity(el.nameBottom, pb, `translateX(${-(1 - pb + out) * 100}cqw)`);
    const vt = clamp01((t - 1700) / 220);
    const shake =
      !this.reducedMotion && t > 1700 && t < 1900 ? (Math.floor(t / 30) % 2 ? 0.6 : -0.6) : 0;
    setOpacity(
      el.vs,
      t > 1700 && t < 2600 ? 1 : 0,
      `translate(calc(-50% + ${shake}cqw),-50%) scale(${1 + 2 * (1 - easeOut(vt))})`,
    );
    const name = this.match?.kind === "duel" ? this.match.opponent.name : "";
    const full = `${practice ? "Practice target set up!" : `${name} wants to duel!`}\nWhen you hear or see SHOOT!, press SPACE to fire.`;
    const typed = t < 2800 ? 0 : Math.min(full.length, Math.floor((t - 2800) / 32));
    this.introTypedAt = 2800 + full.length * 32;
    const done = typed >= full.length;
    const blink = Math.floor(t / 350) % 2;
    setOpacity(el.dialog, t >= 2760 ? 1 : 0);
    const waiting =
      done && this.introEnd !== null && t >= this.introEnd && this.opponentMs === null;
    setText(
      el.dialogText,
      full.slice(0, typed) +
        (waiting ? "\nWaiting for the other hunter…" : done && blink ? " ▼" : ""),
    );
    if (done && this.introEnd === null) this.introEnd = this.introTypedAt + 2000;
    if (this.introEnd !== null && t > this.introEnd - 300 && !waiting) {
      x.globalAlpha = clamp01((t - this.introEnd + 300) / 300);
      f(0, 0, W, H, CREAM);
      x.globalAlpha = 1;
    }
  }

  private drawStandoff(x: CanvasRenderingContext2D, t: number, round: Round, pulse: number) {
    this.layers ??= (() => {
      const S = layer();
      const L = layer();
      return S && L ? { S, L } : null;
    })();
    const layers = this.layers;
    if (!layers) return;
    const { S, L } = layers;
    const draw = round.winner === "draw";
    const shotAt =
      round.shotAt === null
        ? null
        : round.shotAt + (round.winner === "you" || draw ? DRAW_ANIMATION : 0);
    const loser = draw
      ? "both"
      : round.winner === "you"
        ? "opp"
        : round.winner === "opp" && !round.practice
          ? "me"
          : null;
    const oppLoses = loser === "opp" || draw;
    const meLoses = loser === "me" || draw;
    const youShot = round.winner === "you" || draw;
    const oppShot = round.winner === "opp" || draw;
    const fires = (who: "me" | "opp") => (who === "me" ? youShot : oppShot);
    const hitT = loser && shotAt !== null && t >= shotAt ? t - shotAt : -1;
    const revT = hitT >= 0 ? hitT - REVEAL_DELAY : -1;
    const fallT = revT >= 40 ? easeOut(clamp01((revT - 40) / 480)) : 0;
    const drawProgress = (who: "me" | "opp") => {
      if (round.practice && who === "opp") return 0;
      if (fires(who) && shotAt !== null && round.shotAt !== null) {
        return (
          (who === "me"
            ? easeOut(clamp01((t - round.shotAt) / DRAW_ANIMATION))
            : easeOut(clamp01((t - shotAt + 110) / 110))) *
          (1 - fallT * 0.6)
        );
      }
      // Online, your gun comes up the moment you fire; the server says who fell.
      if (who === "me" && round.online && round.you !== null && round.pressAt !== null) {
        return easeOut(clamp01((t - round.pressAt) / DRAW_ANIMATION));
      }
      if (who === "me" && round.lateYou !== null) {
        return easeOut(clamp01((t - round.signalAt - round.lateYou) / 120)) * (1 - fallT * 0.6);
      }
      if (who === "opp" && !round.foul) {
        return clamp01((t - (round.signalAt + round.opponentMs - 120)) / 120) * 0.8;
      }
      if (who === "me" && round.foulRetry && round.pressAt !== null) {
        return (
          easeOut(clamp01((t - round.pressAt) / 90)) *
          lerp(0.75, 0.1, easeOut(clamp01((t - round.pressAt - 250) / 500)))
        );
      }
      if (who === "me" && round.foul && round.pressAt !== null) {
        return easeOut(clamp01((t - round.pressAt) / 90));
      }
      return 0;
    };
    const recoil = (who: "me" | "opp") =>
      fires(who) && shotAt !== null && t >= shotAt ? Math.max(0, 1 - (t - shotAt) / 260) : 0;
    // Screen shake only on the shot: 5 px, decaying over 340 ms.
    const sk = !this.reducedMotion && hitT >= 0 && hitT < 340 ? 5 * (1 - hitT / 340) : 0;
    const shake = Math.round(Math.sin(t * 0.9) * sk);
    const shakeY = Math.round(Math.cos(t * 1.3) * sk * 0.7);
    const O = OTS.opp;
    const M = OTS.me;
    const camera = (c: CanvasRenderingContext2D) => {
      c.setTransform(2, 0, 0, 2, 0, 0);
      c.translate(shake, shakeY);
      c.imageSmoothingEnabled = false;
    };
    const flat = (c: CanvasRenderingContext2D) => {
      c.setTransform(2, 0, 0, 2, 0, 0);
      c.imageSmoothingEnabled = false;
    };

    camera(S);
    S.drawImage(this.street, 0, 0, W, H);
    const oppChest: Pt = [O.x, O.y - 34 * O.sc];
    S.fillStyle = "rgba(40,16,8,0.45)";
    S.beginPath();
    S.ellipse(O.x, O.y + 0.3, (9 + fallT * (oppLoses ? 4 : 0)) * O.sc, 1.8 * O.sc, 0, 0, 7);
    S.fill();

    let oppTip: Pt | null = null;
    camera(L);
    L.save();
    L.translate(O.x, O.y);
    L.scale(O.sc, O.sc);
    if (round.practice) {
      // The practice dummy stands still: no sway, no wobble when hit.
      if (this.dummy) {
        const hh = 62;
        const ww = (hh * this.dummy.width) / this.dummy.height;
        L.drawImage(this.dummy, -ww / 2, -hh, ww, hh);
      }
    } else {
      const fa = oppLoses ? fallT : 0;
      L.scale(1, Math.max(0.12, Math.cos(fa * 1.45)));
      L.transform(1, 0, -fa * 0.25, 1, 0, 0);
      const tip = cowboyFront(L, {
        t,
        ph: 1.7,
        col: COL.opp,
        face: this.faces.oppFace,
        draw: drawProgress("opp"),
        recoil: recoil("opp"),
        hatOff: fa > 0,
      });
      oppTip = [O.x + tip[0] * O.sc, O.y + tip[1] * O.sc];
    }
    L.restore();
    if (oppLoses && revT > 20 && !round.practice) {
      const hp = clamp01((revT - 20) / 800);
      hatFront(
        L,
        O.x + hp * 10 * O.sc,
        O.y + (-58 - Math.sin(hp * Math.PI) * 22 + hp * hp * 58) * O.sc,
        COL.opp,
        hp * 4,
      );
    }
    flattenLayer(L, S);
    if (oppLoses && revT > 480 && revT < 1400 && !round.practice) {
      const q = (revT - 480) / 920;
      for (let i = 0; i < 5; i += 1) {
        puff(
          S,
          O.x + (hash(i + 60) - 0.5) * 30 * (1 + q) * O.sc,
          O.y - 2 - q * 4,
          (5 + q * 9) * O.sc * 1.6,
          "rgba(232,192,138,A)",
          0.4 * (1 - q),
        );
      }
    }
    if (oppShot && hitT >= 0 && oppTip) flashAt(S, oppTip[0], oppTip[1], hitT, 0.7, 0);

    const fm = meLoses ? fallT : 0;
    flat(L);
    L.translate(M.x + shake * 1.5, M.y + fm * 90);
    L.rotate(fm * 0.35);
    L.scale(M.sc, M.sc);
    const shoulder: Pt = [M.x + 8.5 * M.sc, M.y - 42.5 * M.sc];
    const aim = Math.atan2(oppChest[1] - shoulder[1], oppChest[0] - shoulder[0]);
    const dropped = round.foulRetry && round.pressAt !== null && t > round.pressAt + 150;
    const local = cowboyBack(L, {
      t,
      col: COL.me,
      face: this.faces.meFace,
      draw: drawProgress("me"),
      recoil: recoil("me"),
      aim,
      hatOff: fm > 0,
      noGun: dropped,
    });
    const hand: Pt = [M.x + local[0] * M.sc, M.y + local[1] * M.sc];
    this.lastHand = hand;
    flattenLayer(L, S);
    flat(S);
    if (dropped && round.pressAt !== null) {
      // The gun flies out of the hand on a first foul.
      this.dropFrom ??= this.lastHand;
      const q = (t - round.pressAt - 150) / 1000;
      const gx = this.dropFrom[0] + q * 14;
      const gy = Math.min(150, this.dropFrom[1] + 20 * q + 260 * q * q);
      flat(L);
      L.translate(gx, gy);
      L.rotate(q * 9);
      L.scale(M.sc, M.sc);
      revolverSide(L, 7.6);
      flattenLayer(L, S);
      flat(S);
    }
    const tip: Pt = [hand[0] + shake * 1.5, hand[1]];
    if (youShot && hitT >= 0) {
      if (hitT < 60) {
        S.strokeStyle = `rgba(255,240,200,${1 - hitT / 60})`;
        S.lineWidth = 1;
        S.beginPath();
        S.moveTo(tip[0], tip[1]);
        S.lineTo(oppChest[0], oppChest[1]);
        S.stroke();
      }
      flashAt(S, tip[0], tip[1], hitT, 1.4, aim);
      for (let p = 0; p < 4; p += 1) {
        const st = clamp01((hitT - 50 - p * 70) / 1300);
        if (st <= 0 || st >= 1) continue;
        puff(
          S,
          tip[0] + st * 8 - p,
          tip[1] - st * 22 - p * 2,
          3 + st * 9,
          "rgba(225,215,195,A)",
          0.5 * (1 - st),
        );
      }
      if (revT >= 0 && revT < 700) {
        // Blood, or straw from the practice dummy.
        for (let i = 0; i < 14; i += 1) {
          const tt = revT / 1000;
          const px = oppChest[0] + (6 + hash(i) * 16) * tt * (hash(i + 2) > 0.5 ? 1 : -1);
          const py = oppChest[1] - (8 + hash(i + 4) * 18) * tt + 60 * tt * tt;
          S.fillStyle = round.practice
            ? i % 2
              ? "#e2c27a"
              : "#b08a3a"
            : i % 2
              ? "#a51616"
              : "#6e0a0a";
          S.fillRect(Math.round(px), Math.round(py), 1, 1);
        }
      }
    }
    if (meLoses && revT >= 0) {
      if (revT < 260) {
        S.globalAlpha = (1 - revT / 260) * 0.5 * (this.reducedMotion ? 0.4 : 1);
        S.fillStyle = "#b01818";
        S.fillRect(0, 0, W, H);
        S.globalAlpha = 1;
      }
      // A dithered dark-red vignette at the edges.
      const va = easeOut(clamp01(revT / 600));
      S.fillStyle = "#2a0303";
      for (let y = 0; y < H; y += 1) {
        for (let xx = 0; xx < W; xx += 1) {
          const d = Math.hypot((xx - W / 2) / (W / 2), (y - H / 2) / (H / 2));
          if (d > 0.85 && (BAYER[(y & 3) * 4 + (xx & 3)] ?? 0) / 16 < (d - 0.85) * 2.4 * va) {
            S.fillRect(xx, y, 1, 1);
          }
        }
      }
      flat(L);
      drawBloodSplats(L, revT);
      flattenLayer(L, S);
    }
    if (t >= round.signalAt && t < round.signalAt + 80 && !round.foul) {
      S.globalAlpha = this.reducedMotion ? 0.15 : 0.35;
      S.fillStyle = CREAM;
      S.fillRect(0, 0, W, H);
      S.globalAlpha = 1;
    }

    x.save();
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.imageSmoothingEnabled = false;
    x.drawImage(S.canvas, 0, 0, x.canvas.width, x.canvas.height);
    const cw = x.canvas.width;
    const ch = x.canvas.height;
    if (pulse > 0.02) {
      // The heartbeat's red vignette; the camera never moves.
      const vg = x.createRadialGradient(cw / 2, ch / 2, ch * 0.3, cw / 2, ch / 2, cw * 0.62);
      vg.addColorStop(0, "rgba(120,0,0,0)");
      vg.addColorStop(1, `rgba(110,0,0,${0.55 * pulse})`);
      x.fillStyle = vg;
      x.fillRect(0, 0, cw, ch);
    }
    if (hitT >= 0 && hitT < 160) {
      x.fillStyle = `rgba(255,244,214,${(this.reducedMotion ? 0.35 : 0.9) * (1 - hitT / 160)})`;
      x.fillRect(0, 0, cw, ch);
    }
    if (hitT >= 160 && revT < 0) {
      x.fillStyle = `rgba(10,4,2,${0.35 * easeOut(clamp01((hitT - 160) / 250))})`;
      x.fillRect(0, 0, cw, ch);
    }
    if (revT >= 0 && revT < 200) {
      x.fillStyle = `rgba(10,4,2,${0.35 * (1 - revT / 200)})`;
      x.fillRect(0, 0, cw, ch);
    }
    x.restore();
  }
}
