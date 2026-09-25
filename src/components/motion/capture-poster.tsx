"use client";

import Link from "next/link";
import { useEffect, useRef, type CSSProperties, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { usePrefersReducedMotion } from "./gunshot-transition";

/**
 * Capture poster (design_handoff_vaultix_motion, section 3).
 *
 * Shown only after `submitClaimFile()` resolves ok. A large WANTED poster
 * drops in and thuds, and a red stamp with a random capture word slams onto
 * it. The backdrop, Esc and both buttons close it. The form's own "Claim
 * submitted for review" panel stays behind it as the lasting confirmation.
 *
 * Timeline, from the prototype:
 *   0 ms     backdrop fades in (260 ms)
 *   0 ms     poster drops from above (760 ms)
 *   470 ms   dust puffs at the poster's bottom corners (700 ms)
 *   880 ms   stamp slams in (420 ms)
 *   1140 ms  poster thud (300 ms)
 *   1160 ms  ink splats (260 ms)
 *   1450 ms  caption and buttons rise in (420 ms)
 */

export const CAPTURE_WORDS = ["CAPTURED", "BUSTED", "SECURED", "CAUGHT", "BROUGHT IN"] as const;
export type CaptureWord = (typeof CAPTURE_WORDS)[number];

let lastWord: CaptureWord | null = null;

/** Random word, never the same twice in a row. Pick once per success and keep it in state. */
export function pickCaptureWord(): CaptureWord {
  const pool = CAPTURE_WORDS.filter((word) => word !== lastWord);
  const word = pool[Math.floor(Math.random() * pool.length)] ?? "CAPTURED";
  lastWord = word;
  return word;
}

export interface CapturePosterProps {
  readonly courseCode: string;
  readonly courseName: string;
  readonly title: string;
  /** Already formatted, e.g. formatRinggit(wanted.grossBountySen). */
  readonly bountyLabel: string;
  readonly hunterName: string;
  readonly word: CaptureWord;
  readonly onClose: () => void;
  readonly huntHref?: string;
}

/** Ink splats around the stamp: [dx, dy, size], scaled by 3.6, 2.2 and 1.4. */
const SPLATS: ReadonlyArray<readonly [number, number, number]> = [
  [-38, -30, 9],
  [44, -34, 6],
  [52, 22, 10],
  [-50, 26, 7],
  [8, 40, 5],
  [-12, -44, 5],
];

export function CapturePoster({
  courseCode,
  courseName,
  title,
  bountyLabel,
  hunterName,
  word,
  onClose,
  huntHref = "/claims",
}: CapturePosterProps) {
  const still = usePrefersReducedMotion();
  const huntRef = useRef<HTMLAnchorElement>(null);

  // React applies `autoFocus` to form controls only, so the link is focused here.
  useEffect(() => {
    huntRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const stop = (event: MouseEvent) => event.stopPropagation();

  const node = (
    <div
      className={`vx-motion capture-poster${still ? " capture-poster--still" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={`${word}. Claim submitted for ${courseCode}`}
      onClick={onClose}
    >
      <div className="capture-poster__sheet" onClick={stop}>
        <span className="capture-poster__pin" aria-hidden="true" />
        <p className="capture-poster__heading">WANTED</p>
        <div className="capture-poster__portrait">
          <span className="capture-poster__code">{courseCode}</span>
          <span className="capture-poster__course">{courseName}</span>
        </div>
        <p className="capture-poster__title">{title}</p>
        <div className="capture-poster__reward">
          <span className="capture-poster__reward-label">REWARD</span>
          <span className="capture-poster__amount">{bountyLabel}</span>
        </div>
        <p className="capture-poster__hunter">Brought in by {hunterName}</p>

        <div
          className={`capture-poster__stamp${word.length > 8 ? " capture-poster__stamp--long" : ""}`}
        >
          {word}
        </div>
        {SPLATS.map(([dx, dy, size], i) => (
          <span
            key={i}
            className="capture-poster__splat"
            aria-hidden="true"
            style={
              {
                top: `calc(70% + ${dy * 2.2}px)`,
                left: `calc(50% + ${dx * 3.6}px)`,
                width: size * 1.4,
                height: size * 1.4,
              } satisfies CSSProperties
            }
          />
        ))}
        <span className="capture-poster__dust capture-poster__dust--left" aria-hidden="true" />
        <span className="capture-poster__dust capture-poster__dust--right" aria-hidden="true" />
      </div>

      <div className="capture-poster__caption" onClick={stop}>
        <p className="capture-poster__eyebrow">Claim submitted · {courseCode}</p>
        <p className="capture-poster__message">
          Your file is in private quarantine. A Sheriff reviews it next, and you will be notified of
          the decision.
        </p>
        <div className="capture-poster__actions">
          <Link ref={huntRef} href={huntHref} className="capture-poster__hunt" onClick={onClose}>
            Follow it in Hunt →
          </Link>
          <button type="button" className="capture-poster__close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
