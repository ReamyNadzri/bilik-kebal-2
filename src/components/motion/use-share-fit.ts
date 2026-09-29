"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * Fits the share poster and its caption into the viewport with no scrolling
 * (design_handoff_vaultix_tumbleweed_share, section 2).
 *
 * - side: poster and caption side by side, when the viewport is at least
 *   760 px wide and wider than 0.95 × its height. Otherwise they stack.
 * - tight: a compact caption, when stacked or under 700 px tall.
 * - scale: the poster is laid out at a fixed 420 px width with fixed type,
 *   then scaled uniformly, 0.36–1, into the space left over.
 *
 * `sheetRef` is the poster sheet; its offsetHeight ignores transforms, so it
 * is the natural height. `captionRef` is the caption column.
 */
export const POSTER_W = 420;
const CAPTION_W = 400;
const SIDE_GAP = 44;
const STACK_GAP = 18;
const PAD_X = 16;
const SLACK = 8;
const MIN_SCALE = 0.36;

export interface ShareFit {
  readonly side: boolean;
  readonly tight: boolean;
  /** Vertical padding in px, before the safe-area insets. */
  readonly padV: number;
  readonly scale: number;
  /** The poster's natural, unscaled height in px. */
  readonly posterH: number;
}

function layoutShareFit(
  side: boolean,
  vw: number,
  vh: number,
  posterH: number,
  captionH: number,
): { readonly tight: boolean; readonly padV: number; readonly raw: number } {
  const tight = !side || vh < 700;
  const padV = tight ? 16 : 28;
  const availH = side ? vh - padV * 2 - SLACK : vh - padV * 2 - SLACK - captionH - STACK_GAP;
  const availW = side ? vw - CAPTION_W - SIDE_GAP - PAD_X * 2 : vw - PAD_X * 2;
  const fitH = posterH > 0 ? availH / posterH : 1;
  return { tight, padV, raw: Math.min(1, fitH, availW / POSTER_W) };
}

export function measureShareFit(
  vw: number,
  vh: number,
  posterH: number,
  captionH: number,
): ShareFit {
  let side = vw >= 760 && vw > vh * 0.95;
  // A short landscape phone (667×375) cannot stack the two even at the
  // smallest scale, but has the width to set them side by side.
  if (!side && vw > vh && layoutShareFit(false, vw, vh, posterH, captionH).raw < MIN_SCALE) {
    side = layoutShareFit(true, vw, vh, posterH, captionH).raw >= MIN_SCALE;
  }
  const { tight, padV, raw } = layoutShareFit(side, vw, vh, posterH, captionH);
  return { side, tight, padV, scale: Math.max(MIN_SCALE, raw), posterH };
}

const sameFit = (a: ShareFit, b: ShareFit) =>
  a.side === b.side && a.tight === b.tight && a.scale === b.scale && a.posterH === b.posterH;

export function useShareFit(
  sheetRef: RefObject<HTMLElement | null>,
  captionRef: RefObject<HTMLElement | null>,
): ShareFit {
  const [fit, setFit] = useState<ShareFit>({
    side: false,
    tight: true,
    padV: 16,
    scale: 1,
    posterH: 0,
  });

  useLayoutEffect(() => {
    const measure = () => {
      const next = measureShareFit(
        window.innerWidth,
        window.innerHeight,
        sheetRef.current?.offsetHeight ?? 0,
        captionRef.current?.offsetHeight ?? 0,
      );
      setFit((prev) => (sameFit(prev, next) ? prev : next));
    };
    measure();
    // The caption's height follows `tight`, and the sheet's follows its text.
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    if (sheetRef.current) observer?.observe(sheetRef.current);
    if (captionRef.current) observer?.observe(captionRef.current);
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, [sheetRef, captionRef]);

  return fit;
}
