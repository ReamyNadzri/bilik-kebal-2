"use client";

import { useRef, useState } from "react";
import type { WantedSummary } from "@/features/marketplace/types";
import { SharePoster } from "./motion/share-poster";
import { PixelIcon } from "./pixel-icon";

export interface WantedShareButtonProps {
  readonly wanted: WantedSummary;
  readonly className?: string;
  /**
   * The accessible name. On the Board, where a dozen cards each carry one, it
   * names the request ("Share this Wanted: …"); the visible word stays "Share".
   */
  readonly label?: string;
}

/**
 * Share on a Wanted: opens the share poster (picture, caption, WhatsApp,
 * Telegram, the system share sheet). Used on the detail page's masthead and on
 * every Board card, so a request can be passed on without opening it first.
 *
 * Focus goes back to this button when the poster closes.
 */
export function WantedShareButton({
  wanted,
  className = "button button--secondary button--compact",
  label,
}: WantedShareButtonProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`wanted-share ${className}`.trim()}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={label}
      >
        <PixelIcon name="share" className="shell-nav__icon" /> Share
      </button>
      {open ? (
        <SharePoster
          wanted={wanted}
          onClose={() => {
            setOpen(false);
            buttonRef.current?.focus();
          }}
        />
      ) : null}
    </>
  );
}
