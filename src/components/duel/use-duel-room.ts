"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  DuelOpenRoom,
  DuelOperationCode,
  DuelRoomResult,
  DuelRoomState,
} from "@/contracts/duel";
import type { OperationResult } from "@/contracts/operation-result";
import { callOperation, readOperation } from "@/features/presentation/call-operation";
import type { DuelEngine, OnlineShot } from "@/features/presentation/duel/duel-engine";
import { ServerClock } from "@/features/presentation/duel/server-clock";

const UNAVAILABLE: DuelOperationCode = "DUEL_UNAVAILABLE";

/** How often a room is read: quickly while a duel is live, slowly while waiting. */
const POLL_MS = { open: 1500, playing: 350, finished: 1000 } as const;
const ROOMS_POLL_MS = 4000;

export interface DuelRoomOptions {
  readonly engine: () => DuelEngine | null;
  /** Whether the lobby is on screen, so the open rooms are worth reading. */
  readonly inLobby: boolean;
  /** A room code from the link the member followed, joined once on arrival. */
  readonly initialCode: string | null;
  /** A duel begins: put the stage up and start the engine's online match. */
  readonly onStart: (room: DuelRoomState) => void;
  /** The room is gone; back to the lobby with this sentence. */
  readonly onClosed: (message: string | null) => void;
  /** The server decided the current duel. */
  readonly onDecided: (result: DuelRoomResult) => void;
}

/** Leaves a room as the page goes away; the request outlives it. */
function leaveOnUnload(roomId: string) {
  try {
    void fetch(`/api/duel/rooms/${roomId}/leave`, { method: "POST", keepalive: true }).catch(
      () => undefined,
    );
  } catch {
    // Nothing more can be done for a page that is going away.
  }
}

/**
 * An online Duel room, kept in step with the server.
 *
 * The room is read on a timer; every read carries the server's clock, which
 * `ServerClock` turns into this page's time so each round starts, and SHOOT!
 * shows, at the moment the server chose. The engine is told each new round and
 * each decision exactly once.
 */
export function useDuelRoom({
  engine,
  inLobby,
  initialCode,
  onStart,
  onClosed,
  onDecided,
}: DuelRoomOptions) {
  const [room, setRoom] = useState<DuelRoomState | null>(null);
  const [openRooms, setOpenRooms] = useState<DuelOpenRoom[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const clock = useRef(new ServerClock());
  const roomRef = useRef<DuelRoomState | null>(null);
  const startedDuel = useRef(0);
  const scheduledRound = useRef(0);
  const resolvedDuel = useRef(0);
  const handlers = useRef({ engine, onStart, onClosed, onDecided });
  useEffect(() => {
    handlers.current = { engine, onStart, onClosed, onDecided };
  });

  const forget = useCallback(() => {
    roomRef.current = null;
    startedDuel.current = 0;
    scheduledRound.current = 0;
    resolvedDuel.current = 0;
    setRoom(null);
  }, []);

  /** Brings the page in line with what the server says about the room. */
  const apply = useCallback(
    (state: DuelRoomState) => {
      const {
        engine: getEngine,
        onStart: start,
        onClosed: closed,
        onDecided: decided,
      } = handlers.current;
      if (state.status === "closed") {
        const wasDueling = startedDuel.current > 0 && resolvedDuel.current !== state.duelNo;
        const name = state.opponent?.displayName ?? "The other hunter";
        forget();
        closed(wasDueling ? `${name} left the room.` : null);
        return;
      }
      roomRef.current = state;
      setRoom(state);

      if (state.status === "playing" && state.opponent && state.duelNo !== startedDuel.current) {
        startedDuel.current = state.duelNo;
        scheduledRound.current = 0;
        resolvedDuel.current = 0;
        start(state);
      }
      const round = state.round;
      const live = getEngine();
      if (
        live &&
        round &&
        state.status === "playing" &&
        state.duelNo === startedDuel.current &&
        round.number > scheduledRound.current
      ) {
        scheduledRound.current = round.number;
        const startsAt = Date.parse(round.startsAt);
        live.scheduleRound({
          number: round.number,
          startAt: clock.current.toLocal(startsAt),
          signalDelay: Date.parse(round.signalAt) - startsAt,
          yourFouls: round.yourFouls,
          lastFoul: round.lastFoul,
        });
      }
      if (
        live &&
        state.result &&
        state.duelNo === startedDuel.current &&
        resolvedDuel.current !== state.duelNo
      ) {
        resolvedDuel.current = state.duelNo;
        live.resolve(state.result);
        decided(state.result);
      }
    },
    [forget],
  );

  /** One room call, timed so the server's clock can be read from it. */
  const request = useCallback(
    async (call: () => Promise<OperationResult<DuelRoomState, DuelOperationCode>>) => {
      const sentAt = Date.now();
      const answer = await call();
      if (answer.ok) {
        clock.current.observe(answer.data.serverNow, sentAt, Date.now());
        apply(answer.data);
      }
      return answer;
    },
    [apply],
  );

  const open = useCallback(async () => {
    setBusy(true);
    setError(null);
    const answer = await request(() =>
      callOperation<DuelRoomState, DuelOperationCode>("/api/duel/rooms", {}, UNAVAILABLE),
    );
    if (!answer.ok) setError(answer.message);
    setBusy(false);
  }, [request]);

  const join = useCallback(
    async (code: string) => {
      setBusy(true);
      setError(null);
      const answer = await request(() =>
        callOperation<DuelRoomState, DuelOperationCode>(
          "/api/duel/rooms/join",
          { code },
          UNAVAILABLE,
        ),
      );
      if (!answer.ok) setError(answer.message);
      setBusy(false);
    },
    [request],
  );

  const shoot = useCallback(
    (shot: OnlineShot) => {
      const current = roomRef.current;
      if (!current) return;
      void request(() =>
        callOperation<DuelRoomState, DuelOperationCode>(
          `/api/duel/rooms/${current.roomId}/shot`,
          { roundNumber: shot.roundNumber, reactionMs: shot.reactionMs, foul: shot.foul },
          UNAVAILABLE,
        ),
      );
    },
    [request],
  );

  const rematch = useCallback(() => {
    const current = roomRef.current;
    if (!current) return;
    void request(() =>
      callOperation<DuelRoomState, DuelOperationCode>(
        `/api/duel/rooms/${current.roomId}/rematch`,
        {},
        UNAVAILABLE,
      ),
    );
  }, [request]);

  /** Leaves (or closes) the room. After SHOOT! of an undecided duel, that loses it. */
  const leave = useCallback(() => {
    const current = roomRef.current;
    forget();
    if (current) leaveOnUnload(current.roomId);
  }, [forget]);

  // Read the room while in it: quickly during a duel, slowly while waiting.
  const roomId = room?.roomId ?? null;
  const status = room?.status ?? null;
  useEffect(() => {
    if (roomId === null || status === null || status === "closed") return;
    let stopped = false;
    let timer = 0;
    const tick = async () => {
      if (stopped) return;
      const answer = await request(() =>
        readOperation<DuelRoomState, DuelOperationCode>(`/api/duel/rooms/${roomId}`, UNAVAILABLE),
      );
      if (!answer.ok && answer.code === "ROOM_NOT_FOUND") {
        forget();
        handlers.current.onClosed("That room is gone.");
        return;
      }
      if (!stopped && roomRef.current?.roomId === roomId) {
        timer = window.setTimeout(
          tick,
          POLL_MS[roomRef.current.status as keyof typeof POLL_MS] ?? 1000,
        );
      }
    };
    timer = window.setTimeout(tick, POLL_MS[status as keyof typeof POLL_MS] ?? 1000);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [roomId, status, request, forget]);

  // The open rooms, while the member is in the lobby and not in a room.
  useEffect(() => {
    if (!inLobby || roomId !== null) return;
    let stopped = false;
    const read = async () => {
      const answer = await readOperation<DuelOpenRoom[], DuelOperationCode>(
        "/api/duel/rooms",
        UNAVAILABLE,
      );
      if (!stopped && answer.ok) setOpenRooms(answer.data);
    };
    void read();
    const timer = window.setInterval(() => void read(), ROOMS_POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [inLobby, roomId]);

  // A room link: join it once on arrival, then drop the code from the address.
  const joinedLink = useRef(false);
  useEffect(() => {
    if (!initialCode || joinedLink.current) return;
    joinedLink.current = true;
    void join(initialCode);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("room");
      window.history.replaceState(null, "", url.toString());
    } catch {
      // The code staying in the address is harmless.
    }
  }, [initialCode, join]);

  // Leaving the page leaves the room.
  useEffect(
    () => () => {
      const current = roomRef.current;
      if (current) leaveOnUnload(current.roomId);
    },
    [],
  );

  return { room, openRooms, error, busy, open, join, shoot, rematch, leave };
}
