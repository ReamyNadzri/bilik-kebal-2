"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { CampusRegion } from "@/contracts/marketplace";
import { formatRinggit } from "@/features/marketplace/money";

export interface CampusMapProps {
  readonly campuses: readonly CampusRegion[];
  /** False for a viewer who may not see live counts (signed out, unverified email). */
  readonly showCounts: boolean;
}

function describeOpen(count: number): string {
  return `${count} open request${count === 1 ? "" : "s"}`;
}

function pinLabel(campus: CampusRegion, showCounts: boolean): string {
  if (!campus.regionOpen) return `Map pin: ${campus.name}, coming soon`;
  return showCounts
    ? `Map pin: ${campus.name}, ${describeOpen(campus.openWantedCount)}`
    : `Map pin: ${campus.name}, open for requests`;
}

/**
 * The Explore Map: campus pins over the illustrated map, a card for the
 * selected campus, and the same campuses as a list.
 *
 * Every figure is live: campuses, their region state and their open-request
 * counts and bounty totals come from the published regions read. Campuses
 * whose region is not open yet are shown locked ("coming soon") and accept no
 * requests; the lock is enforced by the database, not by this screen.
 *
 * The pins and the list are two ways to make one choice, and both are real
 * buttons carrying `aria-pressed`, so a keyboard or screen-reader user is never
 * left with the list alone while a pointer user gets the map.
 */
export function CampusMap({ campuses, showCounts }: CampusMapProps) {
  const firstOpen = campuses.find((campus) => campus.regionOpen) ?? campuses[0];
  const [selectedId, setSelectedId] = useState(firstOpen?.id ?? "");
  const selected = campuses.find((campus) => campus.id === selectedId) ?? firstOpen;
  const pinned = campuses.filter((campus) => campus.mapX !== null && campus.mapY !== null);
  const openCampuses = campuses.filter((campus) => campus.regionOpen);
  const lockedCampuses = campuses.filter((campus) => !campus.regionOpen);

  if (selected === undefined) {
    return null;
  }

  return (
    <div className="campus-map">
      <div className="campus-map__top">
        <section className="panel campus-map__intro" aria-labelledby="campus-map-title">
          <p className="pixel-label">Welcome, Hunter</p>
          <h1 id="campus-map-title">Where is knowledge needed?</h1>
          <p>
            VAULTIX is opening campus by campus. Select an open campus to see its requests; locked
            campuses are coming soon.
          </p>

          <div className="campus-card" aria-live="polite">
            <h2 className="campus-card__name">{selected.name}</h2>
            {selected.regionOpen ? (
              <>
                <p className="campus-card__state">
                  <span className="status-stamp status-stamp--success">Open</span>
                </p>
                {showCounts ? (
                  <dl className="campus-card__figures">
                    <div>
                      <dt>Open</dt>
                      <dd className="numeric">{selected.openWantedCount}</dd>
                    </div>
                    <div>
                      <dt>Bounty</dt>
                      <dd className="numeric">{formatRinggit(selected.openBountySen)}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="campus-card__note">
                    <Link href="/sign-in?next=/map">Sign in</Link> with a verified email to see open
                    requests and bounties.
                  </p>
                )}
                <Link
                  className="button button--green button--block"
                  href={`/board?campus=${encodeURIComponent(selected.id)}`}
                >
                  View requests here <span aria-hidden="true">→</span>
                </Link>
              </>
            ) : (
              <>
                <p className="campus-card__state">
                  <span className="status-stamp status-stamp--muted">Coming soon</span>
                </p>
                <p className="campus-card__note">
                  This campus is not open for requests yet. VAULTIX is opening region by region.
                </p>
              </>
            )}
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
          {pinned.map((campus) => (
            <button
              key={campus.id}
              type="button"
              className="campus-map__pin"
              style={{ left: `${campus.mapX}%`, top: `${campus.mapY}%` }}
              data-selected={campus.id === selected.id}
              data-locked={!campus.regionOpen}
              aria-pressed={campus.id === selected.id}
              aria-label={pinLabel(campus, showCounts)}
              onClick={() => setSelectedId(campus.id)}
            >
              <span className="campus-map__pin-head" aria-hidden="true" />
            </button>
          ))}
          <figcaption className="campus-map__hint">
            Red pins are open campuses. Grey pins are coming soon.
          </figcaption>
        </figure>
      </div>

      <section className="board-surface" aria-labelledby="campus-list-title">
        <div className="board-surface__head">
          <h2 className="board-surface__heading" id="campus-list-title">
            Open campuses
          </h2>
          <p className="board-surface__lede">
            {showCounts
              ? "Live open requests and gross bounty for each open campus."
              : "Campuses accepting requests now."}
          </p>
        </div>
        <CampusList
          campuses={openCampuses}
          selectedId={selected.id}
          showCounts={showCounts}
          onSelect={setSelectedId}
        />
        {lockedCampuses.length === 0 ? null : (
          <>
            <h3 className="board-surface__heading campus-list__locked-heading">Coming soon</h3>
            <CampusList
              campuses={lockedCampuses}
              selectedId={selected.id}
              showCounts={false}
              onSelect={setSelectedId}
            />
          </>
        )}
      </section>
    </div>
  );
}

function CampusList({
  campuses,
  selectedId,
  showCounts,
  onSelect,
}: {
  readonly campuses: readonly CampusRegion[];
  readonly selectedId: string;
  readonly showCounts: boolean;
  readonly onSelect: (id: string) => void;
}) {
  return (
    <ul className="campus-list" aria-label="Campuses">
      {campuses.map((campus) => (
        <li key={campus.id}>
          <button
            type="button"
            className="campus-list__button"
            data-locked={!campus.regionOpen}
            aria-pressed={campus.id === selectedId}
            onClick={() => onSelect(campus.id)}
          >
            <span className="campus-list__count numeric" aria-hidden="true">
              {campus.regionOpen ? (showCounts ? campus.openWantedCount : "✓") : "—"}
            </span>
            <span className="campus-list__text">
              {/* Long names are cut to two lines; the title keeps the full name. */}
              <span className="campus-list__name" title={campus.name}>
                {campus.name}
              </span>
              <span className="campus-list__meta">
                {!campus.regionOpen
                  ? "Coming soon"
                  : showCounts
                    ? `${formatRinggit(campus.openBountySen)} bounty`
                    : "Open for requests"}
                {campus.regionOpen && showCounts ? (
                  <span className="visually-hidden">{`, ${describeOpen(campus.openWantedCount)}`}</span>
                ) : null}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
