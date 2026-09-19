"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { CampusDemand } from "@/features/marketplace/campus-demand-fixtures";
import { formatRinggit } from "@/features/marketplace/money";

export interface CampusMapProps {
  readonly campuses: readonly CampusDemand[];
  readonly initialCampusId: string;
}

function describeOpen(count: number): string {
  return `${count} open request${count === 1 ? "" : "s"}`;
}

/**
 * The Explore Map: campus pins over the illustrated map, a panel for the
 * selected campus, and the same campuses as a list.
 *
 * The pins and the list are two ways to make one choice, and both are real
 * buttons carrying `aria-pressed`, so a keyboard or screen-reader user is never
 * left with the list alone while a pointer user gets the map. The pins are
 * named "Map pin: …" so the two controls for one campus are distinguishable.
 *
 * Selection lives in component state only. It filters nothing and requests
 * nothing: "View the Wanted Board" links to the Board as it is, because the
 * figures here are fixtures and a campus link would imply they are not.
 */
export function CampusMap({ campuses, initialCampusId }: CampusMapProps) {
  const [selectedId, setSelectedId] = useState(initialCampusId);
  const selected = campuses.find((campus) => campus.id === selectedId) ?? campuses[0];

  if (selected === undefined) {
    return null;
  }

  return (
    <div className="campus-map">
      <div className="campus-map__top">
        <section className="panel campus-map__intro" aria-labelledby="campus-map-title">
          <p className="pixel-label">Welcome, Hunter</p>
          <h1 id="campus-map-title">Where is knowledge needed?</h1>
          <p>Select a campus pin to see its open requests and bounty.</p>

          <div className="campus-card" aria-live="polite">
            <h2 className="campus-card__name">{selected.name}</h2>
            <p className="campus-card__state">{selected.state}</p>
            <dl className="campus-card__figures">
              <div>
                <dt>Open</dt>
                <dd className="numeric">{selected.openCount}</dd>
              </div>
              <div>
                <dt>Bounty</dt>
                <dd className="numeric">{formatRinggit(selected.grossBountySen)}</dd>
              </div>
            </dl>
            <Link className="button button--green button--block" href="/board">
              View the Wanted Board <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>

        <figure className="campus-map__chart">
          <Image
            className="campus-map__image"
            src="/brand/map-malaysia.webp"
            alt="Illustrated map of Malaysia with a pin for each campus"
            width={1672}
            height={941}
            sizes="(min-width: 56rem) 60rem, 100vw"
            priority
          />
          {campuses.map((campus) => (
            <button
              key={campus.id}
              type="button"
              className="campus-map__pin"
              style={{ left: `${campus.x}%`, top: `${campus.y}%` }}
              data-selected={campus.id === selected.id}
              aria-pressed={campus.id === selected.id}
              aria-label={`Map pin: ${campus.name}, ${describeOpen(campus.openCount)}`}
              onClick={() => setSelectedId(campus.id)}
            >
              <span className="campus-map__pin-head" aria-hidden="true" />
            </button>
          ))}
          <figcaption className="campus-map__hint">
            Select a campus pin on the map, or pick one from Bounty by campus below.
          </figcaption>
        </figure>
      </div>

      <section className="board-surface" aria-labelledby="campus-list-title">
        <div className="board-surface__head">
          <h2 className="board-surface__heading" id="campus-list-title">
            Bounty by campus
          </h2>
          <p className="board-surface__lede">
            Open requests and gross bounty for each campus. Development figures, not live totals.
          </p>
        </div>
        <ul className="campus-list" aria-label="Campuses">
          {campuses.map((campus) => (
            <li key={campus.id}>
              <button
                type="button"
                className="campus-list__button"
                aria-pressed={campus.id === selected.id}
                onClick={() => setSelectedId(campus.id)}
              >
                <span className="campus-list__count numeric" aria-hidden="true">
                  {campus.openCount}
                </span>
                <span className="campus-list__text">
                  <span className="campus-list__name">{campus.name}</span>
                  <span className="campus-list__meta">
                    {campus.state} · {formatRinggit(campus.grossBountySen)} bounty
                    <span className="visually-hidden">{`, ${describeOpen(campus.openCount)}`}</span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
