"use client";

import { useState } from "react";
import { DUEL_ROOM_CODE, type DuelOpenRoom, type DuelRoomState } from "@/contracts/duel";
import { formatMs } from "@/features/presentation/duel/duel-rules";
import { PixelPortrait } from "./pixel-portrait";

export interface DuelOnlinePanelProps {
  /** The member's own open room, while it waits for a challenger. */
  readonly hosting: DuelRoomState | null;
  readonly rooms: readonly DuelOpenRoom[];
  readonly busy: boolean;
  readonly error: string | null;
  readonly onOpen: () => void;
  readonly onClose: () => void;
  readonly onJoin: (code: string) => void;
}

/**
 * Online duels in the lobby: open a room and share it, or join one that is
 * waiting. The duel starts by itself when a second hunter joins.
 */
export function DuelOnlinePanel({
  hosting,
  rooms,
  busy,
  error,
  onOpen,
  onClose,
  onJoin,
}: DuelOnlinePanelProps) {
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const codeValid = DUEL_ROOM_CODE.test(code.trim());

  const link =
    hosting && typeof window !== "undefined"
      ? `${window.location.origin}/duel?room=${hosting.code}`
      : "";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // The link is on screen to copy by hand.
    }
  };

  return (
    <section className="duel-online" aria-labelledby="duel-online-heading">
      <div className="duel-field__heading">
        <h2 className="duel-field__title" id="duel-online-heading">
          Online
        </h2>
        <span className="duel-field__aside">
          Duel a hunter who is here right now. Online duels count for both of you.
        </span>
      </div>

      {error === null ? null : (
        <p className="duel-notice" role="alert">
          {error}
        </p>
      )}

      {hosting ? (
        <div className="duel-online__hosting" role="status">
          <p className="duel-online__label">YOUR ROOM IS OPEN</p>
          <p className="duel-online__code">
            <span className="visually-hidden">Room code </span>
            {hosting.code}
          </p>
          <p className="duel-online__wait">
            Waiting for a hunter to join… The duel starts as soon as someone does. Keep this page
            open.
          </p>
          <p className="duel-online__link">{link}</p>
          <div className="duel-online__actions">
            <button type="button" className="duel-button" onClick={() => void copyLink()}>
              {copied ? "LINK COPIED" : "COPY LINK"}
            </button>
            <button type="button" className="duel-button duel-button--quiet" onClick={onClose}>
              CLOSE ROOM
            </button>
          </div>
        </div>
      ) : (
        <div className="duel-online__start">
          <button
            type="button"
            id="duel-online-open"
            className="duel-button"
            disabled={busy}
            onClick={onOpen}
          >
            OPEN A ROOM
          </button>
          <form
            className="duel-online__join"
            onSubmit={(event) => {
              event.preventDefault();
              if (codeValid) onJoin(code.trim().toUpperCase());
            }}
          >
            <label className="visually-hidden" htmlFor="duel-room-code">
              Room code
            </label>
            <input
              id="duel-room-code"
              className="duel-online__input"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="ROOM CODE"
              maxLength={6}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="submit"
              className="duel-button duel-button--quiet"
              disabled={busy || !codeValid}
            >
              JOIN
            </button>
          </form>
        </div>
      )}

      {hosting ? null : rooms.length === 0 ? (
        <p className="duel-field__empty">
          No open rooms right now. Open one and share the link with a friend.
        </p>
      ) : (
        <ul className="duel-online__rooms" aria-label="Open rooms">
          {rooms.map((room) => (
            <li key={room.code} className="duel-opponent">
              <div className="duel-opponent__portrait">
                <PixelPortrait src={room.host.avatarUrl} className="duel-pixel" />
              </div>
              <div className="duel-opponent__body">
                <span className="duel-opponent__name">{room.host.displayName}</span>
                <span className="duel-opponent__times">
                  Avg draw {formatMs(room.host.averageMs)}
                </span>
                <span className="duel-opponent__campus">Room {room.code}</span>
              </div>
              <button
                type="button"
                className="duel-button duel-opponent__duel"
                disabled={busy}
                aria-label={`Join ${room.host.displayName}'s room`}
                onClick={() => onJoin(room.code)}
              >
                JOIN
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
