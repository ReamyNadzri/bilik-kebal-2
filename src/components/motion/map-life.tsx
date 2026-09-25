"use client";

import type { CSSProperties } from "react";
import { usePrefersReducedMotion } from "./gunshot-transition";

/**
 * Living map layer (design_handoff_vaultix_motion, section 4).
 *
 * Mounted in campus-map.tsx directly after the map image and before the pins.
 * It sizes itself to the image (aspect-ratio 1672/941), not to the figure,
 * because the figure also holds the figcaption.
 *
 * Coordinates are pixels on the 1672 x 941 art in public/brand/map-malaysia.webp.
 * The ship rects are cut from that art; if it is ever redrawn, re-measure them.
 */

const W = 1672;
const H = 941;

type Vars = CSSProperties & Record<`--${string}`, string>;

/** Sea glints, % of map [left, top]. */
const GLINTS: ReadonlyArray<readonly [number, number]> = [
  [52, 10],
  [58, 17],
  [66, 11],
  [71, 22],
  [55, 33],
  [63, 39],
  [50, 48],
  [86, 18],
  [84, 70],
  [80, 93],
  [5, 70],
  [62, 95],
  [44, 58],
  [93, 44],
];

/** Painted ships on the art, source px rect [x, y, w, h]. Each gets a bobbing copy and a wake. */
const SHIPS: ReadonlyArray<readonly [number, number, number, number]> = [
  [938, 294, 72, 66],
  [1572, 598, 80, 76],
  [876, 800, 86, 82],
  [205, 780, 86, 76],
];

/** Birds inside a flock, px offsets. */
const BIRD_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [20, 9],
  [32, -7],
  [46, 12],
  [12, 22],
];

/** Places a cut-out of the map art: the geometry of one source rect. */
function sprite(sx: number, sy: number, sw: number, sh: number, extra: Vars): Vars {
  return {
    aspectRatio: `${sw} / ${sh}`,
    backgroundSize: `${(W / sw) * 100}% auto`,
    backgroundPosition: `${(sx / (W - sw)) * 100}% ${(sy / (H - sh)) * 100}%`,
    ...extra,
  };
}

export interface MapLifeProps {
  readonly sea?: boolean;
  readonly ships?: boolean;
  readonly birds?: boolean;
}

export function MapLife({ sea = true, ships = true, birds = true }: MapLifeProps) {
  const reduced = usePrefersReducedMotion();
  if (reduced) return null;

  return (
    <div className="vx-motion map-life" aria-hidden="true">
      {sea
        ? GLINTS.map(([x, y], i) => (
            <span
              key={`g${i}`}
              className="map-life__glint"
              style={
                {
                  left: `${x}%`,
                  top: `${y}%`,
                  "--vx-dur": `${2.6 + (i % 4) * 0.5}s`,
                  "--vx-delay": `${(i * 0.43) % 3}s`,
                } as Vars
              }
            />
          ))
        : null}

      {ships ? (
        <>
          {SHIPS.map(([sx, sy, sw, sh], i) => (
            <div
              key={`s${i}`}
              className="map-life__ship"
              style={{
                left: `${(sx / W) * 100}%`,
                top: `${(sy / H) * 100}%`,
                width: `${(sw / W) * 100}%`,
                aspectRatio: `${sw} / ${sh}`,
              }}
            >
              <span className="map-life__wake" style={{ "--vx-delay": `${i * 0.6}s` } as Vars} />
              <div
                className="map-life__sprite"
                style={sprite(sx, sy, sw, sh, {
                  "--vx-dur": `${3 + i * 0.4}s`,
                  "--vx-delay": `${i * -0.9}s`,
                })}
              />
            </div>
          ))}
          {/* One extra ship sailing the South China Sea lane and back (turns around at the ends). */}
          <div className="map-life__lane">
            <div className="map-life__turn" style={{ width: `${(72 / W) * 100}%` }}>
              <div
                className="map-life__sprite"
                style={sprite(938, 294, 72, 66, { "--vx-dur": "3.2s", "--vx-delay": "0s" })}
              />
            </div>
          </div>
        </>
      ) : null}

      {birds ? (
        <>
          <Flock dur={26} delay={-4} from={["-8%", "38%"]} to={["108%", "4%"]} count={5} />
          <Flock dur={34} delay={-18} from={["106%", "72%"]} to={["-10%", "30%"]} count={3} />
        </>
      ) : null}
    </div>
  );
}

function Flock({
  dur,
  delay,
  from,
  to,
  count,
}: {
  readonly dur: number;
  readonly delay: number;
  readonly from: readonly [string, string];
  readonly to: readonly [string, string];
  readonly count: number;
}) {
  return (
    <div
      className="map-life__flock"
      style={
        {
          "--x0": from[0],
          "--y0": from[1],
          "--x1": to[0],
          "--y1": to[1],
          "--vx-dur": `${dur}s`,
          "--vx-delay": `${delay}s`,
        } as Vars
      }
    >
      {BIRD_OFFSETS.slice(0, count).map(([bx, by], i) => (
        <span
          key={i}
          className="map-life__bird"
          style={{ left: bx, top: by, "--vx-delay": `${i * -0.13}s` } as Vars}
        >
          <span className="map-life__wing map-life__wing--left" />
          <span className="map-life__wing map-life__wing--right" />
        </span>
      ))}
    </div>
  );
}
