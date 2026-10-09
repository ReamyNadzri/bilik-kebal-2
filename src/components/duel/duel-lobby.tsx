"use client";

import { useState, type ReactNode } from "react";
import {
  DUEL_GHOST_MIN_SHOTS,
  DUEL_PRACTICE_LEVELS,
  type DuelLobby as DuelLobbyData,
  type DuelOpponent,
  type DuelPracticeLevel,
} from "@/contracts/duel";
import { formatMs, killDeathRatio, rankOf, winRate } from "@/features/presentation/duel/duel-rules";
import { PixelPortrait } from "./pixel-portrait";

export interface DuelLobbyProps {
  readonly lobby: DuelLobbyData;
  readonly playerName: string;
  readonly playerPicture: string | null;
  /** A refusal or failure to show above the opponents, if any. */
  readonly notice: string | null;
  readonly busy: boolean;
  readonly onDuel: (opponent: DuelOpponent) => void;
  readonly onPractice: (level: DuelPracticeLevel) => void;
  readonly onListing: (listed: boolean) => void;
  readonly onReset: () => void;
  /** Shown under the record and the field, across the whole width. */
  readonly footer?: ReactNode;
  /** Online duels, shown above the ghosts. */
  readonly online?: ReactNode;
}

const OUTCOME_CHIP = { win: "W", lose: "L", draw: "D" } as const;

function historyDetail(item: DuelLobbyData["record"]["history"][number]): string {
  if (item.outcome === "lose") {
    if (item.fouls >= 2) return "Too early";
    return item.youMs === null
      ? `Too slow · ${item.themMs} ms`
      : `${item.youMs} vs ${item.themMs} ms`;
  }
  return `${item.youMs ?? "—"} vs ${item.themMs} ms`;
}

/** Where the member's own ghost stands, in words. */
function ghostStatus(record: DuelLobbyData["record"]): string {
  if (!record.listed) return "Your ghost is hidden. Nobody can challenge it.";
  if (record.shots < DUEL_GHOST_MIN_SHOTS) {
    return `Your ghost joins the opponents after ${DUEL_GHOST_MIN_SHOTS} clean shots (${record.shots} of ${DUEL_GHOST_MIN_SHOTS} so far).`;
  }
  return "Your ghost is on the board. Other hunters see your name, picture, campus, average and fastest draw.";
}

/**
 * The Duel's lobby: the member's record, the practice field and the ghosts
 * they may challenge. Every number is the server's; nothing is kept in the
 * browser.
 */
export function DuelLobby({
  lobby,
  playerName,
  playerPicture,
  notice,
  busy,
  onDuel,
  onPractice,
  onListing,
  onReset,
  footer = null,
  online = null,
}: DuelLobbyProps) {
  const { record, opponents } = lobby;
  const [confirmingReset, setConfirmingReset] = useState(false);
  const duels = record.kills + record.deaths + record.draws;

  return (
    <div className="duel-lobby">
      <header className="duel-lobby__header">
        <p className="duel-lobby__eyebrow">HIGH NOON</p>
        <h1 className="duel-lobby__title">Duel</h1>
        <p className="duel-lobby__intro">
          Pick a hunter. When the screen says SHOOT, press Space or tap. The faster draw wins and
          the other one is out. Shoot too early and you lose.
        </p>
      </header>

      <div className="duel-lobby__row">
        <section className="duel-record" aria-labelledby="duel-record-heading">
          <div className="duel-record__who">
            <div className="duel-record__portrait">
              <PixelPortrait src={playerPicture} className="duel-pixel" />
            </div>
            <div className="duel-record__name-block">
              <p className="duel-record__eyebrow" id="duel-record-heading">
                YOUR RECORD
              </p>
              <p className="duel-record__name">{playerName}</p>
            </div>
          </div>

          <dl className="duel-record__stats">
            <div className="duel-record__kd">
              <dt>K/D</dt>
              <dd>{killDeathRatio(record)}</dd>
            </div>
            <div className="duel-stat">
              <dt>Kills</dt>
              <dd className="duel-stat__value duel-stat__value--kills">{record.kills}</dd>
            </div>
            <div className="duel-stat">
              <dt>Deaths</dt>
              <dd className="duel-stat__value duel-stat__value--deaths">{record.deaths}</dd>
            </div>
            <div className="duel-stat">
              <dt>Win rate</dt>
              <dd className="duel-stat__value">{winRate(record)}</dd>
            </div>
            <div className="duel-stat">
              <dt>Fastest draw</dt>
              <dd className="duel-stat__value">{formatMs(record.bestMs)}</dd>
            </div>
            <div className="duel-stat">
              <dt>Avg draw</dt>
              <dd className="duel-stat__value">{formatMs(record.averageMs)}</dd>
            </div>
            <div className="duel-stat">
              <dt>Duels</dt>
              <dd className="duel-stat__value">{duels}</dd>
            </div>
          </dl>

          <div className="duel-record__history">
            <h2 className="duel-record__eyebrow">RECENT DUELS</h2>
            {record.history.length === 0 ? (
              <p className="duel-record__empty">No duels yet.</p>
            ) : (
              <ul className="duel-history">
                {record.history.map((item) => (
                  <li key={`${item.at}-${item.opponentPublicId}`} className="duel-history__item">
                    <span className={`duel-history__chip duel-history__chip--${item.outcome}`}>
                      <span aria-hidden="true">{OUTCOME_CHIP[item.outcome]}</span>
                      <span className="visually-hidden">
                        {item.outcome === "win" ? "Won" : item.outcome === "draw" ? "Draw" : "Lost"}
                        {" against"}
                      </span>
                    </span>
                    <span className="duel-history__name">{item.opponentName}</span>
                    <span className="duel-history__detail">{historyDetail(item)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="duel-record__ghost">
            <label className="duel-record__listing">
              <input
                type="checkbox"
                checked={record.listed}
                disabled={busy}
                onChange={(event) => onListing(event.target.checked)}
              />
              Let other hunters duel my ghost
            </label>
            <p className="duel-record__ghost-status">{ghostStatus(record)}</p>
          </div>

          {confirmingReset ? (
            <div className="duel-record__reset" role="group" aria-label="Reset your Duel record">
              <p>This deletes your duels, practice shots and draw times. It cannot be undone.</p>
              <div className="duel-record__reset-actions">
                <button
                  type="button"
                  className="duel-link duel-link--danger"
                  disabled={busy}
                  onClick={() => {
                    setConfirmingReset(false);
                    onReset();
                  }}
                >
                  Yes, reset my record
                </button>
                <button
                  type="button"
                  className="duel-link"
                  onClick={() => setConfirmingReset(false)}
                >
                  Keep it
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="duel-link duel-link--danger"
              disabled={busy || (duels === 0 && record.shots === 0)}
              onClick={() => setConfirmingReset(true)}
            >
              Reset record
            </button>
          )}
        </section>

        <section className="duel-field" aria-label="Practice and opponents">
          <div className="duel-field__heading">
            <h2 className="duel-field__title">Practice field</h2>
            <span className="duel-field__aside">Doesn&rsquo;t count toward K/D</span>
          </div>
          <ul className="duel-practice">
            {DUEL_PRACTICE_LEVELS.map((level) => {
              const stats = record.practice[level.id];
              const summary = stats
                ? `${stats.hits}/${stats.tries} hits${stats.bestMs === null ? "" : ` · best ${stats.bestMs} ms`}`
                : "Not tried yet";
              return (
                <li key={level.id}>
                  <button
                    type="button"
                    id={`duel-practice-${level.id}`}
                    aria-label={`Practice ${level.name}: beat ${level.targetMs} ms. ${summary}.`}
                    className="duel-practice__tile"
                    disabled={busy}
                    onClick={() => onPractice(level.id)}
                  >
                    <span className={`duel-practice__name duel-practice__name--${level.id}`}>
                      {level.name.toUpperCase()}
                    </span>
                    <span className="duel-practice__target">{level.targetMs} ms</span>
                    <span className="duel-practice__stats">{summary}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          {online}
          <div className="duel-field__heading duel-field__heading--opponents">
            <h2 className="duel-field__title">Ghost opponents</h2>
            <span className="duel-field__aside">
              Real hunters&rsquo; ghosts: they shoot around their real average draw
            </span>
          </div>
          {notice === null ? null : (
            <p className="duel-notice" role="alert">
              {notice}
            </p>
          )}
          {opponents.length === 0 ? (
            <p className="duel-field__empty">
              No ghosts to duel yet. Hunters appear here after {DUEL_GHOST_MIN_SHOTS} clean shots.
              Take a few practice shots to put yours on the board.
            </p>
          ) : (
            <ul className="duel-opponents">
              {opponents.map((opponent) => {
                const rank = rankOf(opponent.averageMs);
                const faced = opponent.wins + opponent.losses + opponent.draws > 0;
                return (
                  <li key={opponent.publicId} className="duel-opponent">
                    <div className="duel-opponent__portrait">
                      <PixelPortrait src={opponent.avatarUrl} className="duel-pixel" />
                    </div>
                    <div className="duel-opponent__body">
                      <span className="duel-opponent__name">{opponent.displayName}</span>
                      <span className="duel-opponent__campus">
                        {opponent.institutionName ?? "VAULTIX hunter"}
                      </span>
                      <span className="duel-opponent__times">
                        Avg draw {opponent.averageMs} ms · best {opponent.bestMs} ms
                      </span>
                      <span className="duel-opponent__meta">
                        <span className={`duel-rank duel-rank--${rank.toLowerCase()}`}>{rank}</span>
                        <span className="duel-opponent__record">
                          {faced
                            ? `${opponent.wins}W – ${opponent.losses}L${opponent.draws ? ` – ${opponent.draws}D` : ""}`
                            : "Not faced yet"}
                        </span>
                      </span>
                    </div>
                    <button
                      type="button"
                      id={`duel-opponent-${opponent.publicId}`}
                      aria-label={`Duel ${opponent.displayName}`}
                      className="duel-button duel-opponent__duel"
                      disabled={busy}
                      onClick={() => onDuel(opponent)}
                    >
                      DUEL
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {opponents.length === 0 ? null : (
            <p className="duel-field__aside">
              More hunters join this list once they have {DUEL_GHOST_MIN_SHOTS} clean shots, from
              duels or practice. You never appear in your own list.
            </p>
          )}
        </section>
      </div>
      {footer}
    </div>
  );
}
