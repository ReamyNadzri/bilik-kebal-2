"use client";

import { useEffect, useId, useRef, useState } from "react";
import { PixelArt } from "./pixel-art";
import { PixelPictureEditor } from "./pixel-picture-editor";
import { PIXEL_PALETTE, PRESET_PICTURES } from "@/features/presentation/pixel-drawings";
import {
  drawingToAvatarCanvas,
  pixelBlobToAvatarCanvas,
  uploadAvatarCanvas,
} from "@/features/presentation/avatar-upload";

export interface AvatarPixelArtProps {
  /** Called with the saved picture's public URL. */
  readonly onSaved: (avatarUrl: string | null) => void;
  readonly onError: (message: string) => void;
  readonly disabled?: boolean;
}

const FAILED = "Your picture was not saved. Check your connection and try again.";

/**
 * The Wanted poster's picture tools for the profile picture (request,
 * 2026-10-02): turn a photo into pixel art, or pick one of the fifty pixel
 * drawings. Either is saved as an ordinary uploaded avatar, through the same
 * checked upload as a photo.
 */
export function AvatarPixelArt({ onSaved, onError, disabled = false }: AvatarPixelArtProps) {
  const [open, setOpen] = useState<"photo" | "drawing" | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(make: () => Promise<HTMLCanvasElement> | HTMLCanvasElement) {
    setBusy(true);
    try {
      onSaved(await uploadAvatarCanvas(await make()));
      setOpen(null);
    } catch {
      onError(FAILED);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="button button--secondary button--compact hunter-card__upload"
        onClick={() => setOpen("photo")}
        disabled={disabled || busy}
      >
        Pixel art from a photo
      </button>
      <button
        type="button"
        className="button button--secondary button--compact hunter-card__upload"
        onClick={() => setOpen("drawing")}
        disabled={disabled || busy}
      >
        Choose a pixel drawing
      </button>

      {open === "photo" ? (
        <PixelPictureEditor
          heading="Your photo as pixel art"
          lede="It becomes your profile picture, which every member can see. Use a photo you have the right to share."
          onClose={() => setOpen(null)}
          onDone={({ blob }) => void save(() => pixelBlobToAvatarCanvas(blob))}
        />
      ) : null}

      {open === "drawing" ? (
        <DrawingPicker
          busy={busy}
          onClose={() => setOpen(null)}
          onPick={(index) => {
            const picture = PRESET_PICTURES[index];
            if (picture) void save(() => drawingToAvatarCanvas(picture.rows, PIXEL_PALETTE));
          }}
        />
      ) : null}
    </>
  );
}

function DrawingPicker({
  busy,
  onClose,
  onPick,
}: {
  readonly busy: boolean;
  readonly onClose: () => void;
  readonly onPick: (index: number) => void;
}) {
  const headingId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  return (
    <div
      className="dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      ref={dialogRef}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !busy) onClose();
      }}
    >
      <div className="dialog">
        <div className="dialog__head">
          <h2 id={headingId} className="dialog__title">
            Choose a pixel drawing
          </h2>
          <button
            type="button"
            className="button button--quiet dialog__close"
            onClick={onClose}
            aria-label="Close dialog"
            disabled={busy}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <p className="dialog__lede" aria-live="polite">
          {busy ? "Saving your picture…" : "The same fifty drawings a Wanted poster can use."}
        </p>
        <ul className="avatar-drawings" aria-label="Pixel drawings">
          {PRESET_PICTURES.map((picture, index) => (
            <li key={picture.name}>
              <button
                type="button"
                className="avatar-drawings__choice"
                aria-label={picture.name}
                title={picture.name}
                disabled={busy}
                onClick={() => onPick(index)}
              >
                <PixelArt rows={picture.rows} palette={PIXEL_PALETTE} className="resource-emblem" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
