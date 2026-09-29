"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { usePrefersReducedMotion } from "./gunshot-transition";

/**
 * A tumbleweed that now and then rolls along the bottom of the viewport
 * (design_handoff_vaultix_tumbleweed_share, section 1).
 *
 * The first pass comes 15–40 s after mount, then one every 50–120 s. Each pass
 * picks a random sprite, size, direction, speed, hop height and spin. A pass
 * is skipped, but the next one still scheduled, while the tab is hidden. None
 * runs under reduced motion or when `enabled` is false. Only one exists at a
 * time; it is removed when the outer roll ends.
 *
 * Decorative only: aria-hidden and pointer-events none, portalled to the body
 * so it sits above the wood rails and hunter slots (z 90) and below the
 * capture/share poster (z 250) and the gunshot overlay (z 300).
 */

const SPRITES = [
  "/brand/tumbleweed-1.webp",
  "/brand/tumbleweed-2.webp",
  "/brand/tumbleweed-3.webp",
] as const;

const FIRST_PASS_MS: readonly [number, number] = [15_000, 40_000];
const NEXT_PASS_MS: readonly [number, number] = [50_000, 120_000];

interface Pass {
  readonly id: number;
  readonly src: string;
  /** px square, 70–125. */
  readonly size: number;
  /** 60% of passes roll left to right. */
  readonly ltr: boolean;
  /** Seconds to cross the viewport, 7–12, linear. */
  readonly dur: number;
  /** Seconds per bounce, 0.55–0.90. */
  readonly hopDur: number;
  /** Bounce height in px, size × 0.25–0.60. */
  readonly hop: number;
  /** Seconds per turn, 0.9–1.5. */
  readonly spin: number;
  /** px above the viewport bottom, 4–22. */
  readonly bottom: number;
}

type Vars = CSSProperties & Record<`--${string}`, string>;

const rand = (min: number, max: number) => min + Math.random() * (max - min);

let passCount = 0;

function makePass(): Pass {
  const size = Math.round(rand(70, 125));
  passCount += 1;
  return {
    id: passCount,
    src: SPRITES[Math.floor(Math.random() * SPRITES.length)] ?? SPRITES[0],
    size,
    ltr: Math.random() < 0.6,
    dur: rand(7, 12),
    hopDur: rand(0.55, 0.9),
    hop: Math.round(size * rand(0.25, 0.6)),
    spin: rand(0.9, 1.5),
    bottom: Math.round(rand(4, 22)),
  };
}

export function Tumbleweed({ enabled = true }: { readonly enabled?: boolean }) {
  const still = usePrefersReducedMotion();
  const [pass, setPass] = useState<Pass | null>(null);
  const active = enabled && !still;

  useEffect(() => {
    if (!active) return;
    let timer: number;
    const schedule = ([min, max]: readonly [number, number]) => {
      timer = window.setTimeout(
        () => {
          if (!document.hidden) setPass(makePass());
          schedule(NEXT_PASS_MS);
        },
        rand(min, max),
      );
    };
    schedule(FIRST_PASS_MS);
    return () => window.clearTimeout(timer);
  }, [active]);

  // A pass already rolling disappears at once if motion is turned off mid-way.
  if (!active || pass === null) return null;

  const off = pass.size + 40;
  const style: Vars = {
    bottom: pass.bottom,
    width: pass.size,
    height: pass.size,
    "--tw-x0": pass.ltr ? `-${off}px` : `calc(100vw + ${off}px)`,
    "--tw-x1": pass.ltr ? `calc(100vw + ${off}px)` : `-${off}px`,
    "--tw-dur": `${pass.dur}s`,
    "--tw-hop": `${pass.hop}px`,
    "--tw-hop-dur": `${pass.hopDur}s`,
    "--tw-spin": `${pass.spin}s`,
  };

  return createPortal(
    <div
      key={pass.id}
      className="vx-motion tumbleweed"
      style={style}
      aria-hidden="true"
      data-testid="tumbleweed"
      onAnimationEnd={(event) => {
        // The hop and spin are infinite; only the outer roll ever ends.
        if (event.target === event.currentTarget) setPass(null);
      }}
    >
      <div className="tumbleweed__hop">
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny decorative sprite, no layout to optimise */}
        <img
          className={`tumbleweed__img${pass.ltr ? "" : " tumbleweed__img--rev"}`}
          src={pass.src}
          alt=""
          draggable={false}
        />
      </div>
    </div>,
    document.body,
  );
}
