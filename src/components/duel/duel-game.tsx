"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  DUEL_PRACTICE_LEVELS,
  type DuelLobby as DuelLobbyData,
  type DuelLobbyResult,
  type DuelOpponent,
  type DuelOperationCode,
  type DuelPracticeLevel,
  type DuelPracticeResult,
  type DuelRoundResult,
  type DuelRoundStart,
} from "@/contracts/duel";
import { callOperation, readOperation } from "@/features/presentation/call-operation";
import { DuelAudio } from "@/features/presentation/duel/duel-audio";
import { DuelEngine, type Decision, type Ticket } from "@/features/presentation/duel/duel-engine";
import {
  formatMs,
  killDeathRatio,
  rankOf,
  winRate,
  type ResultCopy,
} from "@/features/presentation/duel/duel-rules";
import { usePrefersReducedMotion } from "@/components/motion/gunshot-transition";
import { useThemeMusicHold } from "@/components/theme-music";
import { duelPixelFont } from "./duel-font";
import { DuelLobby } from "./duel-lobby";

type Phase = "lobby" | "intro" | "standoff" | "result";

type Current =
  | { readonly kind: "duel"; readonly opponent: DuelOpponent }
  | { readonly kind: "practice"; readonly level: DuelPracticeLevel };

export interface DuelGameProps {
  readonly initialLobby: DuelLobbyData;
  readonly playerName: string;
  readonly playerPicture: string | null;
}

const UNAVAILABLE: DuelOperationCode = "DUEL_UNAVAILABLE";

/** Posts the decision of a round the member is leaving; the request outlives the page. */
function settleOnLeave(path: string, body: unknown) {
  try {
    void fetch(path, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => undefined);
  } catch {
    // Nothing more can be done for a page that is going away.
  }
}

/**
 * The Duel: the lobby, and the full-screen stage the game is played on.
 *
 * Each duel is opened by the server, which draws the ghost's time, and closed
 * by the server, which decides it; this screen only plays it out and reports
 * the member's reaction. Leaving after a round is decided still reports it.
 */
export function DuelGame({ initialLobby, playerName, playerPicture }: DuelGameProps) {
  const [phase, setPhase] = useState<Phase>("lobby");
  const [lobby, setLobby] = useState(initialLobby);
  const [current, setCurrent] = useState<Current | null>(null);
  const [result, setResult] = useState<ResultCopy | null>(null);
  const [resultNote, setResultNote] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const musicOn = useThemeMusicHold();

  const audioRef = useRef<DuelAudio | null>(null);
  const engineRef = useRef<DuelEngine | null>(null);
  /** The open round's id, once the server has issued it. */
  const roundRef = useRef<Promise<string | null> | null>(null);
  const currentRef = useRef<Current | null>(null);
  const phaseRef = useRef<Phase>("lobby");
  const returnFocusRef = useRef<string | null>(null);

  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const nameTop = useRef<HTMLDivElement>(null);
  const nameBottom = useRef<HTMLDivElement>(null);
  const vs = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const dialogText = useRef<HTMLSpanElement>(null);
  const message = useRef<HTMLDivElement>(null);
  const timer = useRef<HTMLDivElement>(null);
  const hint = useRef<HTMLDivElement>(null);
  const againButton = useRef<HTMLButtonElement>(null);

  const changePhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const refreshLobby = useCallback(async () => {
    const fresh: DuelLobbyResult = await readOperation("/api/duel", UNAVAILABLE);
    if (fresh.ok) setLobby(fresh.data);
  }, []);

  /** Sends a decided round to the server, which records it and answers the totals. */
  const settle = useCallback(
    async (decision: Decision, leaving: boolean) => {
      const playing = currentRef.current;
      if (!playing) return;
      if (playing.kind === "practice") {
        const body = {
          level: playing.level,
          reactionMs: decision.reactionMs,
          foul: decision.round.foul,
        };
        if (leaving) return settleOnLeave("/api/duel/practice", body);
        const answer = await callOperation<DuelPracticeResult, DuelOperationCode>(
          "/api/duel/practice",
          body,
          UNAVAILABLE,
        );
        if (!answer.ok) setResultNote(`This shot was not recorded. ${answer.message}`);
        await refreshLobby();
        return;
      }
      const roundId = await roundRef.current;
      if (!roundId) return;
      const body = { reactionMs: decision.reactionMs, fouls: decision.fouls };
      if (leaving) return settleOnLeave(`/api/duel/rounds/${roundId}`, body);
      const answer = await callOperation<DuelRoundResult, DuelOperationCode>(
        `/api/duel/rounds/${roundId}`,
        body,
        UNAVAILABLE,
      );
      if (!answer.ok) {
        setResultNote(`This duel was not recorded. ${answer.message}`);
        return;
      }
      setLobby((before) => ({
        ...before,
        record: {
          ...before.record,
          kills: answer.data.kills,
          deaths: answer.data.deaths,
          draws: answer.data.draws,
        },
      }));
      await refreshLobby();
    },
    [refreshLobby],
  );

  const toLobby = useCallback(() => {
    const engine = engineRef.current;
    const pending = engine?.stop() ?? null;
    if (pending) void settle(pending, true);
    audioRef.current?.cancelSpeech();
    changePhase("lobby");
    setResult(null);
    void refreshLobby();
  }, [changePhase, refreshLobby, settle]);

  // One engine and one audio graph for the life of the page.
  useEffect(() => {
    const audio = new DuelAudio();
    audioRef.current = audio;
    const engine = new DuelEngine(
      audio,
      {
        onStandoff: () => changePhase("standoff"),
        onDecided: (decision) => void settle(decision, false),
        onResult: (copy) => {
          setResult(copy);
          changePhase("result");
        },
        onAbort: (reason) => {
          setNotice(reason);
          changePhase("lobby");
        },
      },
      reducedMotion,
    );
    engineRef.current = engine;
    return () => {
      const pending = engine.stop();
      if (pending) void settle(pending, true);
      audio.close();
      engineRef.current = null;
      audioRef.current = null;
    };
    // The engine is built once; motion preference is read at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.setPlayer({ name: playerName, pictureUrl: playerPicture });
  }, [playerName, playerPicture]);

  // The music loops only in the lobby, and only with Music on.
  useEffect(() => {
    audioRef.current?.setMusic(musicOn && phase === "lobby");
  }, [musicOn, phase]);

  // Browsers allow sound only after a gesture; any gesture on this page unlocks it.
  useEffect(() => {
    const unlock = () => audioRef.current?.unlock();
    const onVisibility = () => audioRef.current?.setHidden(document.hidden);
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const begin = useCallback(
    (next: Current) => {
      const engine = engineRef.current;
      if (!engine) return;
      audioRef.current?.unlock();
      audioRef.current?.setMusic(false);
      setNotice(null);
      setResult(null);
      setResultNote(null);
      currentRef.current = next;
      setCurrent(next);
      returnFocusRef.current =
        next.kind === "duel"
          ? `duel-opponent-${next.opponent.publicId}`
          : `duel-practice-${next.level}`;
      if (next.kind === "duel") {
        const started = callOperation<DuelRoundStart, DuelOperationCode>(
          "/api/duel/rounds",
          { opponentPublicId: next.opponent.publicId },
          UNAVAILABLE,
        );
        roundRef.current = started.then((answer) => (answer.ok ? answer.data.roundId : null));
        const ticket: Ticket = started.then((answer) =>
          answer.ok
            ? { ok: true as const, opponentMs: answer.data.opponentMs }
            : { ok: false as const, message: answer.message },
        );
        engine.start({
          kind: "duel",
          opponent: { name: next.opponent.displayName, pictureUrl: next.opponent.avatarUrl },
          ticket,
        });
      } else {
        roundRef.current = null;
        const level = DUEL_PRACTICE_LEVELS.find((candidate) => candidate.id === next.level);
        if (!level) return;
        engine.start({
          kind: "practice",
          name: `Target · ${level.name}`,
          targetMs: level.targetMs,
        });
      }
      changePhase("intro");
    },
    [changePhase],
  );

  const rematch = useCallback(() => {
    const playing = currentRef.current;
    if (playing) begin(playing);
  }, [begin]);

  // Space (or Enter) fires and skips; Escape leaves. Only while the stage is up.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const now = phaseRef.current;
      if (now === "lobby") return;
      if (event.key === "Escape") {
        event.preventDefault();
        toLobby();
        return;
      }
      const space = event.code === "Space" || event.key === " ";
      // On the result card Enter belongs to the focused button.
      if (!(space || (event.key === "Enter" && now !== "result"))) return;
      if (now === "result" && event.target instanceof HTMLButtonElement) return;
      event.preventDefault();
      if (event.repeat) return;
      if (now === "result") {
        if (engineRef.current?.inResult) rematch();
        return;
      }
      engineRef.current?.press();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rematch, toLobby]);

  // The stage's elements, handed to the engine while it is up.
  const inGame = phase !== "lobby";
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (!inGame) {
      engine.attach(null);
      const id = returnFocusRef.current;
      if (id) document.getElementById(id)?.focus();
      return;
    }
    const parts = [canvas, nameTop, nameBottom, vs, dialog, dialogText, message, timer, hint].map(
      (ref) => ref.current,
    );
    if (parts.some((part) => part === null)) return;
    engine.attach({
      canvas: canvas.current!,
      nameTop: nameTop.current!,
      nameBottom: nameBottom.current!,
      vs: vs.current!,
      dialog: dialog.current!,
      dialogText: dialogText.current!,
      message: message.current!,
      timer: timer.current!,
      hint: hint.current!,
    });
    stage.current?.focus();
  }, [inGame]);

  useEffect(() => {
    if (phase === "result") againButton.current?.focus();
  }, [phase]);

  const setListing = useCallback(async (listed: boolean) => {
    setBusy(true);
    setNotice(null);
    const answer = await callOperation<{ listed: boolean }, DuelOperationCode>(
      "/api/duel/listing",
      { listed },
      UNAVAILABLE,
      "PUT",
    );
    if (answer.ok) {
      setLobby((before) => ({
        ...before,
        record: { ...before.record, listed: answer.data.listed },
      }));
    } else {
      setNotice(answer.message);
    }
    setBusy(false);
  }, []);

  const reset = useCallback(async () => {
    setBusy(true);
    setNotice(null);
    const answer = await callOperation<{ reset: true }, DuelOperationCode>(
      "/api/duel/record",
      {},
      UNAVAILABLE,
      "DELETE",
    );
    if (answer.ok) await refreshLobby();
    else setNotice(answer.message);
    setBusy(false);
  }, [refreshLobby]);

  const opponentName =
    current?.kind === "duel"
      ? current.opponent.displayName
      : `Target · ${DUEL_PRACTICE_LEVELS.find((level) => level.id === current?.level)?.name ?? ""}`;
  const opponentSub =
    current?.kind === "duel"
      ? `${rankOf(current.opponent.averageMs)} · ${current.opponent.institutionName ?? "VAULTIX hunter"}`
      : "PRACTICE FIELD";
  const practiceStats = current?.kind === "practice" ? lobby.record.practice[current.level] : null;

  return (
    <div className="duel">
      <DuelLobby
        lobby={lobby}
        playerName={playerName}
        playerPicture={playerPicture}
        notice={notice}
        busy={busy}
        onDuel={(opponent) => begin({ kind: "duel", opponent })}
        onPractice={(level) => begin({ kind: "practice", level })}
        onListing={(listed) => void setListing(listed)}
        onReset={() => void reset()}
      />

      {/* On the body, above the shell and its stacking contexts. */}
      {inGame
        ? createPortal(
            <div
              ref={stage}
              className={`duel-stage ${duelPixelFont.variable}`}
              role="dialog"
              aria-modal="true"
              aria-label={`Duel against ${opponentName}`}
              tabIndex={-1}
              onPointerDown={(event) => {
                if (phaseRef.current !== "intro" && phaseRef.current !== "standoff") return;
                if (event.button !== 0) return;
                event.preventDefault();
                engineRef.current?.press();
              }}
            >
              <div className="duel-stage__screen">
                <canvas
                  ref={canvas}
                  className="duel-stage__canvas"
                  width={1280}
                  height={720}
                  aria-hidden="true"
                />

                <div ref={nameTop} className="duel-plate duel-plate--top" aria-hidden="true">
                  <span className="duel-plate__name">{opponentName}</span>
                  <span className="duel-plate__sub">{opponentSub}</span>
                </div>
                <div ref={nameBottom} className="duel-plate duel-plate--bottom" aria-hidden="true">
                  <span className="duel-plate__name">{playerName}</span>
                  <span className="duel-plate__sub">K/D {killDeathRatio(lobby.record)}</span>
                </div>
                <div ref={vs} className="duel-stage__vs" aria-hidden="true">
                  VS
                </div>
                <div ref={dialog} className="duel-dialog">
                  <span ref={dialogText} className="duel-dialog__text" />
                </div>

                <div
                  ref={message}
                  className="duel-stage__message"
                  role="status"
                  aria-live="assertive"
                />
                <div ref={timer} className="duel-stage__timer" />
                <div ref={hint} className="duel-stage__hint" aria-hidden="true">
                  SPACE OR TAP WHEN IT SAYS SHOOT
                </div>

                {phase === "standoff" || phase === "result" ? (
                  <div className="duel-stage__hud" aria-hidden="true">
                    <span>{playerName}</span>
                    <span>{opponentName}</span>
                  </div>
                ) : null}

                <button
                  type="button"
                  className="duel-stage__leave"
                  // Not a shot: the stage fires on any other press.
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={toLobby}
                >
                  Leave<span className="visually-hidden"> the duel</span>
                  <span className="duel-key" aria-hidden="true">
                    ESC
                  </span>
                </button>

                {phase === "result" && result ? (
                  <div className="duel-result" onPointerDown={(event) => event.stopPropagation()}>
                    <div
                      className="duel-result__card"
                      role="group"
                      aria-labelledby="duel-result-title"
                    >
                      <p className="duel-result__eyebrow">VS {opponentName.toUpperCase()}</p>
                      <h2
                        id="duel-result-title"
                        className={`duel-result__title duel-result__title--${result.tone}`}
                      >
                        {result.title}
                      </h2>
                      <p className="duel-result__line">{result.line}</p>
                      <dl className="duel-result__times">
                        <div>
                          <dt>You</dt>
                          <dd>{result.you}</dd>
                        </div>
                        <div>
                          <dt>{opponentName}</dt>
                          <dd>{result.them}</dd>
                        </div>
                      </dl>
                      {current?.kind === "practice" ? (
                        <dl className="duel-result__stats">
                          <div>
                            <dt>TRIES</dt>
                            <dd>{practiceStats?.tries ?? "—"}</dd>
                          </div>
                          <div>
                            <dt>HITS</dt>
                            <dd className="duel-stat__value--kills">
                              {practiceStats?.hits ?? "—"}
                            </dd>
                          </div>
                          <div>
                            <dt>BEST</dt>
                            <dd>{formatMs(practiceStats?.bestMs)}</dd>
                          </div>
                          <div>
                            <dt>AVG</dt>
                            <dd>{formatMs(practiceStats?.averageMs)}</dd>
                          </div>
                        </dl>
                      ) : (
                        <dl className="duel-result__stats">
                          <div>
                            <dt>KILLS</dt>
                            <dd className="duel-stat__value--kills">{lobby.record.kills}</dd>
                          </div>
                          <div>
                            <dt>DEATHS</dt>
                            <dd className="duel-stat__value--deaths">{lobby.record.deaths}</dd>
                          </div>
                          <div>
                            <dt>K/D</dt>
                            <dd>{killDeathRatio(lobby.record)}</dd>
                          </div>
                          <div>
                            <dt>WIN</dt>
                            <dd>{winRate(lobby.record)}</dd>
                          </div>
                        </dl>
                      )}
                      {resultNote === null ? null : (
                        <p className="duel-result__note" role="alert">
                          {resultNote}
                        </p>
                      )}
                      <div className="duel-result__actions">
                        <button
                          ref={againButton}
                          type="button"
                          className="duel-button"
                          onClick={rematch}
                        >
                          {current?.kind === "practice" ? "AGAIN" : "REMATCH"}
                          <span className="duel-key" aria-hidden="true">
                            SPACE
                          </span>
                        </button>
                        <button
                          type="button"
                          className="duel-button duel-button--quiet"
                          onClick={toLobby}
                        >
                          OPPONENTS
                          <span className="duel-key" aria-hidden="true">
                            ESC
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
