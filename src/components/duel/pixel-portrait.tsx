"use client";

import { useEffect, useRef } from "react";
import { pixelPicture } from "@/features/presentation/duel/duel-pictures";

/**
 * A member's picture as the Duel's pixel art, on a 64 px canvas. Decorative:
 * the member's name is always written beside it.
 */
export function PixelPortrait({
  src,
  className,
}: {
  readonly src: string | null;
  readonly className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let current = true;
    void pixelPicture(src, 64, "bust").then((art) => {
      const context = canvas.current?.getContext("2d");
      if (!current || !art || !context) return;
      context.clearRect(0, 0, 64, 64);
      context.drawImage(art, 0, 0);
    });
    return () => {
      current = false;
    };
  }, [src]);

  return <canvas ref={canvas} width={64} height={64} className={className} aria-hidden="true" />;
}
